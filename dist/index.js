'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});

var _createClass = function () { function defineProperties(target, props) { for (var i = 0; i < props.length; i++) { var descriptor = props[i]; descriptor.enumerable = descriptor.enumerable || false; descriptor.configurable = true; if ("value" in descriptor) descriptor.writable = true; Object.defineProperty(target, descriptor.key, descriptor); } } return function (Constructor, protoProps, staticProps) { if (protoProps) defineProperties(Constructor.prototype, protoProps); if (staticProps) defineProperties(Constructor, staticProps); return Constructor; }; }(); /*
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       MIT License http://www.opensource.org/licenses/mit-license.php
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       Author Tobias Koppers @sokra
                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                     */


var _ConstDependency = require('webpack/lib/dependencies/ConstDependency');

var _ConstDependency2 = _interopRequireDefault(_ConstDependency);

var _NullFactory = require('webpack/lib/NullFactory');

var _NullFactory2 = _interopRequireDefault(_NullFactory);

var _MissingLocalizationError = require('./MissingLocalizationError');

var _MissingLocalizationError2 = _interopRequireDefault(_MissingLocalizationError);

var _MakeLocalizeFunction = require('./MakeLocalizeFunction');

var _MakeLocalizeFunction2 = _interopRequireDefault(_MakeLocalizeFunction);

function _interopRequireDefault(obj) { return obj && obj.__esModule ? obj : { default: obj }; }

function _classCallCheck(instance, Constructor) { if (!(instance instanceof Constructor)) { throw new TypeError("Cannot call a class as a function"); } }

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
var I18nPlugin = function () {
  function I18nPlugin(localization, options, failOnMissing) {
    _classCallCheck(this, I18nPlugin);

    // Backward-compatiblility
    if (typeof options === 'string') {
      options = {
        functionName: options
      };
    }

    if (typeof failOnMissing !== 'undefined') {
      options.failOnMissing = failOnMissing;
    }

    // Promises waiting for localization calls resolving
    this.promises = [];
    this.options = options || {};
    this.localization = (0, _MakeLocalizeFunction2.default)(localization, !!this.options.nested);
    this.functionName = this.options.functionName || '__';
    this.failOnMissing = !!this.options.failOnMissing;
    this.hideMessage = this.options.hideMessage || false;
  }

  _createClass(I18nPlugin, [{
    key: 'apply',
    value: function apply(compiler) {
      var _this = this;

      var promises = this.promises,
          localization = this.localization,
          failOnMissing = this.failOnMissing,
          hideMessage = this.hideMessage; // eslint-disable-line no-unused-vars

      var name = this.functionName;

      compiler.plugin('compilation', function (compilation, params) {
        // eslint-disable-line no-unused-vars
        compilation.dependencyFactories.set(_ConstDependency2.default, new _NullFactory2.default());
        compilation.dependencyTemplates.set(_ConstDependency2.default, new _ConstDependency2.default.Template());
      });

      compiler.plugin('compilation', function (compilation, data) {
        // Use optimize-tree async hook to pause module sealing
        // while waiting for localization calls to be resolved
        compilation.plugin('optimize-tree', function (chunks, modules, callback) {
          var promisesCount = _this.promises.length;
          if (promisesCount > 0) {
            var promiseFinally = function promiseFinally() {
              // Remove finalized promise from the array of pending
              promisesCount -= 1;
              // Complete compilation step after all promises were finalized
              if (promisesCount === 0) {
                callback();
              }
            };
            _this.promises.forEach(function (p) {
              // TODO: use Promise.prototype.finally instead (check node version)
              p.then(promiseFinally, promiseFinally);
            });
          } else {
            callback();
          }
          _this.promises.length = 0;
        });

        data.normalModuleFactory.plugin('parser', function (parser, options) {
          // eslint-disable-line no-unused-vars
          // Should use function here instead of arrow function due to save the Tapable's context
          parser.plugin(`call ${name}`, function i18nPlugin(expr) {
            var param = void 0;
            var defaultValue = void 0;

            var state = this.state;
            var applyResult = function applyResult(result) {
              var dep = new _ConstDependency2.default(JSON.stringify(result), expr.range);
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

            promises[promises.length] = localization(param, defaultValue).then(function (resultValue) {
              applyResult(resultValue);
            }, function (defaultValue) {
              applyResult(defaultValue);

              // TODO: error output
              var error = state.module[__dirname];
              if (!error) {
                error = new _MissingLocalizationError2.default(state.module, param, defaultValue);
                state.module[__dirname] = error;

                if (failOnMissing) {
                  state.module.errors.push(error);
                } else if (!hideMessage) {
                  state.module.warnings.push(error);
                }
              } else if (!error.requests.includes(param)) {
                error.add(param, defaultValue);
              }
            });

            return true;
          });
        });
      });
    }
  }]);

  return I18nPlugin;
}();

exports.default = I18nPlugin;