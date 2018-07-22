import makeLocalizeFunction from '../src/MakeLocalizeFunction';

describe('MakeLocalizeFunction', () => {
  const onFulfilled = () => { };
  const onRejected = () => { };

  describe('with nested support', () => {
    let localize;

    beforeEach(() => {
      const nested = true;
      const translations = {
        'a.b.c': 'bar',
        a: {
          b: {
            c: 'Foo',
          },
        },
      };

      localize = makeLocalizeFunction(translations, nested);
    });

    it('should return Promise', () => {
      expect(localize()).toBeInstanceOf(Promise);
    });

    it('should be resolved with `Foo` for `a.b.c`', () => {
      localize('a.b.c').then(
        (value) => {
          expect(value).toEqual('Foo');
        },
        onRejected,
      );
    });

    it('should be rejected with `undefined` for the missing translation', () => {
      localize('the missing translation').then(
        onFulfilled,
        (defaultValue) => {
          expect(defaultValue).toEqual(undefined); // eslint-disable-line no-undefined
        },
      );
    });
  });

  describe('without nested support', () => {
    let localize;

    beforeEach(() => {
      const nested = false;
      const translations = {
        'a.b.c': 'bar',
        a: {
          b: {
            c: 'Foo',
          },
        },
      };

      localize = makeLocalizeFunction(translations, nested);
    });

    it('should return Promise', () => {
      expect(localize()).toBeInstanceOf(Promise);
    });

    it('should be resolved with `bar` for `a.b.c`', () => {
      localize('a.b.c').then(
        (value) => {
          expect(value).toEqual('bar');
        },
        onRejected,
      );
    });

    it('should be rejected with `undefined` for the missing translation', () => {
      localize('the missing translation').then(
        onFulfilled,
        (defaultValue) => {
          expect(defaultValue).toEqual(undefined); // eslint-disable-line no-undefined
        },
      );
    });
  });
});
