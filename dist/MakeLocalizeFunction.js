"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.default = void 0;

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
    let result;

    if (param) {
      if (typeof localization === 'function') {
        result = localization(param);
      } else if (localization) {
        result = nested ? byString(localization, param) : localization[param];
      }
    }

    return Promise.resolve(result).then(value => {
      if (typeof value !== 'undefined') {
        return Promise.resolve(value);
      } else {
        return Promise.reject(defaultValue);
      }
    }, // Rethrow rejected Promise with default value
    () => Promise.reject(defaultValue || ''));
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
  const keys = nestedKey.replace(/^\./, '').split('.'); // loop through the keys to find the nested value

  for (let i = 0, length = keys.length; i < length; ++i) {
    const key = keys[i];

    if (!(key in localization)) {
      return;
    }

    localization = localization[key];
  }

  return localization;
}

var _default = makeLocalizeFunction;
exports.default = _default;