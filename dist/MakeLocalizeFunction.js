'use strict';

Object.defineProperty(exports, "__esModule", {
  value: true
});
/**
 * Convert the localization object into a function
 * Returned function will always return Promise itself
 *
 * @param {object|function} localization
 * @param {boolean} nested
 *
 * @returns {function}
 */
function makeLocalizeFunction(localization, nested) {
  /**
   * @param {string} param - name of the resource
   * @param {string} [defaultValue] - default resource value
   *
   * @returns {Promise}
   */
  return function localizeFunction(param, defaultValue) {
    var result = void 0;

    if (param) {
      if (typeof localization === 'function') {
        result = localization(param);
      } else if (localization) {
        result = nested ? byString(localization, param) : localization[param];
      }
    }

    if (result instanceof Promise) {
      return result.then(function (result) {
        return result;
      }, function () {
        return defaultValue;
      });
    }

    return new Promise(function (resolve, reject) {
      if (typeof result !== 'undefined') {
        resolve(result);
      } else {
        reject(defaultValue);
      }
    });
  };
}

/**
 * Find the key if the key is a path expressed with dots
 *
 * e.g.
 * Code: __("errors.connectionError")
 * Lang: {"errors": {"connectionError": "There was an error connecting."}}
 * New Code: "There was an error connecting."
 *
 * @param {Object} localization
 * @param {String} nestedKey The original key
 *
 * @returns {*}
 */
function byString(localization, nestedKey) {
  // remove a leading dot and split by dot
  var keys = nestedKey.replace(/^\./, '').split('.');

  // loop through the keys to find the nested value
  for (var i = 0, length = keys.length; i < length; ++i) {
    var key = keys[i];

    if (!(key in localization)) {
      return;
    }

    localization = localization[key];
  }

  return localization;
}

exports.default = makeLocalizeFunction;