/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
import ConstDependency from 'webpack/lib/dependencies/ConstDependency';
import NullFactory from 'webpack/lib/NullFactory';
import MissingLocalizationError from './MissingLocalizationError';
import makeLocalizeFunction from './MakeLocalizeFunction';

/**
 * @constructor
 * @param {object|function} localization
 * @param {object|string} options - object or obselete functionName string
 * @param {string} [options.functionName] - name of the function to be parsed and replaced with translations
 * @param {boolean} [options.nested] - should key names with dot-separator be processed like paths to nested elements,
 *                                     makes sense only when localization is of object type
 * @param {boolean} [options.failOnMissing] - throw error and interrupt build process when localization is missing
 * @param {boolean} [options.hideMessage] - suppress warnings output during build process
 */
class I18nPlugin {
  constructor(localization, options, failOnMissing) {
    // Backward-compatiblility
    if (typeof options === 'string') {
      options = {
        functionName: options,
      };
    }

    if (typeof failOnMissing !== 'undefined') {
      options.failOnMissing = failOnMissing;
    }

    // Promises waiting for localization calls resolving
    this.promises = [];
    this.options = options || {};
    this.localization = makeLocalizeFunction(localization, !!this.options.nested);
    this.functionName = this.options.functionName || '__';
    this.failOnMissing = !!this.options.failOnMissing;
    this.hideMessage = this.options.hideMessage || false;
  }

  apply(compiler) {
    const { promises, localization, failOnMissing, hideMessage } = this; // eslint-disable-line no-unused-vars
    const name = this.functionName;

    compiler.plugin('compilation', (compilation, params) => { // eslint-disable-line no-unused-vars
      compilation.dependencyFactories.set(ConstDependency, new NullFactory());
      compilation.dependencyTemplates.set(ConstDependency, new ConstDependency.Template());
    });

    compiler.plugin('compilation', (compilation, data) => {
      // Use optimize-tree async hook to pause module sealing
      // while waiting for localization calls to be resolved
      compilation.plugin('optimize-tree', (chunks, modules, callback) => {
        let promisesCount = this.promises.length;
        if (promisesCount > 0) {
          const promiseFinally = () => {
            // Remove finalized promise from the array of pending
            promisesCount -= 1;
            // Complete compilation step after all promises were finalized
            if (promisesCount === 0) {
              callback();
            }
          };
          this.promises.forEach((p) => {
            // TODO: use Promise.prototype.finally instead (check node version)
            p.then(promiseFinally, promiseFinally);
          });
        } else {
          callback();
        }
        this.promises = [];
      });

      data.normalModuleFactory.plugin('parser', (parser, options) => { // eslint-disable-line no-unused-vars
        // Should use function here instead of arrow function due to save the Tapable's context
        parser.plugin(`call ${name}`, function i18nPlugin(expr) {
          let param;
          let defaultValue;

          const state = this.state;
          const applyResult = (result) => {
            const dep = new ConstDependency(JSON.stringify(result), expr.range);
            dep.loc = expr.loc;
            state.current.addDependency(dep);
          };

          switch (expr.arguments.length) {
            case 2:
              param = this.evaluateExpression(expr.arguments[1]);
              if (!param.isString()) return;
              param = param.string;
              defaultValue = this.evaluateExpression(expr.arguments[0]);
              if (!defaultValue.isString()) return;
              defaultValue = defaultValue.string;
              break;
            case 1:
              param = this.evaluateExpression(expr.arguments[0]);
              if (!param.isString()) return;
              param = param.string;
              defaultValue = param;
              break;
            default:
              return;
          }

          promises[promises.length] = localization(param, defaultValue).then(
            (resultValue) => {
              applyResult(resultValue);
            },
            (defaultValue) => {
              applyResult(defaultValue);

              // TODO: error output
              let error = state.module[__dirname];
              if (!error) {
                error = new MissingLocalizationError(state.module, param, defaultValue);
                state.module[__dirname] = error;

                if (failOnMissing) {
                  state.module.errors.push(error);
                } else if (!hideMessage) {
                  state.module.warnings.push(error);
                }
              } else if (!error.requests.includes(param)) {
                error.add(param, defaultValue);
              }
            },
          );

          return true;
        });
      });
    });
  }
}

export default I18nPlugin;
