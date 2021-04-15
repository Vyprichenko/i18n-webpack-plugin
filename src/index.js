/*
  MIT License http://www.opensource.org/licenses/mit-license.php
  Author Tobias Koppers @sokra
*/
import ConstDependency from 'webpack/lib/dependencies/ConstDependency';
import NullFactory from 'webpack/lib/NullFactory';
import MissingLocalizationError from './MissingLocalizationError';
import makeLocalizeFunction from './MakeLocalizeFunction';

/**
 *
 * @param {object|function} localization
 * @param {object|string} Options object or obselete functionName string
 * @constructor
 */
class I18nPlugin {
  constructor(localization, poptions, failOnMissing) {
    let options = poptions;
    // Backward-compatiblility
    if (typeof options === 'string') {
      options = {
        functionName: options,
      };
    }

    if (typeof failOnMissing !== 'undefined') {
      options.failOnMissing = failOnMissing;
    }

    this.options = options || {};
    this.localization = makeLocalizeFunction(
      localization,
      !!this.options.nested,
    );
    this.promises = [];
    this.functionName = this.options.functionName || '__';
    this.failOnMissing = !!this.options.failOnMissing;
    this.hideMessage = this.options.hideMessage || false;
  }

  apply(compiler) {
    const PLUGIN_NAME = 'I18nPlugin';
    const { localization, promises, failOnMissing, hideMessage } = this;
    const name = this.functionName;

    compiler.hooks.compilation.tap(
      PLUGIN_NAME,
      (compilation, { normalModuleFactory }) => {
        compilation.dependencyFactories.set(
          ConstDependency,
          new NullFactory(),
        );
        compilation.dependencyTemplates.set(
          ConstDependency,
          new ConstDependency.Template(),
        );

        // Use optimize-tree async hook to pause module sealing
        // while waiting for localization calls to be resolved
        compilation.hooks.optimizeTree.tapAsync(
          PLUGIN_NAME,
          (chunks, modules, callback) => {
            if (promises.length > 0) {
              Promise.allSettled(promises).finally(callback);
            } else {
              callback();
            }
          },
        );

        // Adds functionName(...) calls replacements to the parser state
        const handleLocalization = (state, expr, result) => {
          const dep = new ConstDependency(
            JSON.stringify(result),
            expr.range,
          );
          dep.loc = expr.loc;
          state.current.addDependency(dep);
          return result;
        };

        // Hooks javascript parsers to replace functionName(...) calls
        // with localized string values
        const handleParser = (parser) => {
          parser.hooks.call.for(name).tap(
            `call ${name}`,
            function i18nPlugin(expr) {
              const { state } = this;
              let param;
              let defaultValue;
              switch (expr.arguments.length) {
                case 2:
                  param = expr.arguments[1].value;
                  if (typeof param !== 'string') return;
                  defaultValue = expr.arguments[0].value;
                  if (typeof defaultValue !== 'string') { return; }
                  break;
                case 1:
                  param = expr.arguments[0].value;
                  if (typeof param !== 'string') return;
                  defaultValue = param;
                  break;
                default:
                  return;
              }

              promises[promises.length] = localization(
                param,
              ).then(
                result =>
                  handleLocalization(state, expr, result),
                (result) => {
                  let error = state.module[__dirname];
                  if (!error) {
                    error = new MissingLocalizationError(
                      state.module,
                      param,
                      defaultValue,
                    );
                    state.module[__dirname] = error;

                    if (failOnMissing) {
                      state.module.errors.push(error);
                    } else if (!hideMessage) {
                      state.module.warnings.push(error);
                    }
                  } else if (
                    !error.requests.includes(param)
                  ) {
                    error.add(param, defaultValue);
                  }
                  return handleLocalization(
                    state,
                    expr,
                    result,
                  );
                },
              );
              return true;
            }.bind(parser),
          );
        };

        normalModuleFactory.hooks.parser
          .for('javascript/auto')
          .tap(PLUGIN_NAME, handleParser);

        normalModuleFactory.hooks.parser
          .for('javascript/dynamic')
          .tap(PLUGIN_NAME, handleParser);

        normalModuleFactory.hooks.parser
          .for('javascript/esm')
          .tap(PLUGIN_NAME, handleParser);
      },
    );
  }
}

export default I18nPlugin;
