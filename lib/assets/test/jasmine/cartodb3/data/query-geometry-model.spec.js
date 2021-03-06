var Backbone = require('backbone');
var ConfigModel = require('../../../../javascripts/cartodb3/data/config-model');
var QueryGeometryModel = require('../../../../javascripts/cartodb3/data/query-geometry-model');

describe('data/query-geometry-model', function () {
  beforeEach(function () {
    this.xhrSpy = jasmine.createSpyObj('xhr', ['abort', 'always', 'fail']);
    spyOn(Backbone.Model.prototype, 'sync').and.returnValue(this.xhrSpy);
    spyOn(Backbone.Model.prototype, 'fetch').and.callThrough();

    var configModel = new ConfigModel({
      base_url: '/u/pepe',
      api_key: 'xyz123'
    });
    this.model = new QueryGeometryModel({
      ready: true
    }, {
      configModel: configModel
    });
  });

  it('should not have any geometry initially', function () {
    expect(this.model.get('simple_geom')).toBeFalsy();
  });

  describe('when there is no query set', function () {
    it('should be unavailable by default', function () {
      expect(this.model.get('status')).toEqual('unavailable');
    });

    it('should not allow to fetch', function () {
      expect(this.model.fetch());
      expect(Backbone.Model.prototype.fetch).not.toHaveBeenCalled();
    });
  });

  describe('when it is not ready', function () {
    beforeEach(function () {
      this.model.set({
        ready: false,
        query: 'SELECT * FROM wherever'
      });
    });

    it('should not allow to fetch', function () {
      expect(this.model.fetch());
      expect(Backbone.Model.prototype.fetch).not.toHaveBeenCalled();
    });
  });

  describe('when a query is changed', function () {
    beforeEach(function () {
      this.model.set('query', 'SELECT * FROM foo');
    });

    it('should update status accordingly', function () {
      expect(this.model.get('status')).toEqual('unfetched');

      this.model.unset('query');
      expect(this.model.get('status')).toEqual('unavailable');
    });

    describe('when fetch', function () {
      beforeEach(function () {
        this.model.fetch();
      });

      it('should fetch with a wrapped query', function () {
        expect(Backbone.Model.prototype.fetch).toHaveBeenCalled();
        expect(Backbone.Model.prototype.fetch.calls.argsFor(0)[0].data.q).toMatch(/^SELECT .+$/);
        expect(Backbone.Model.prototype.fetch.calls.argsFor(0)[0].data.q).toMatch(/FROM \(.+\) .+$/);
      });

      it('should add order, rows and page', function () {
        expect(Backbone.Model.prototype.fetch.calls.argsFor(0)[0].data.rows_per_page).toBe(40);
        expect(Backbone.Model.prototype.fetch.calls.argsFor(0)[0].data.page).toBe(0);
        expect(Backbone.Model.prototype.fetch.calls.argsFor(0)[0].data.sort_order).toBe('asc');
      });

      it('should fetch using an API key', function () {
        expect(Backbone.Model.prototype.fetch.calls.argsFor(0)[0].data.api_key).toEqual('xyz123');
      });

      it('should change status', function () {
        expect(this.model.get('status')).toEqual('fetching');
      });

      describe('when a request is already ongoing', function () {
        beforeEach(function () {
          this.model.fetch();
        });

        it('should cancel current request', function () {
          expect(this.xhrSpy.abort).toHaveBeenCalled();
        });

        it('should fetch again', function () {
          expect(Backbone.Model.prototype.fetch.calls.count()).toEqual(2);
        });
      });

      describe('when request succeeds', function () {
        beforeEach(function () {
          Backbone.Model.prototype.sync.calls.argsFor(0)[2].success({
            fields: {
              cartodb_id: {type: 'number'},
              title: {type: 'string'},
              the_geom: {type: 'string'}
            },
            rows: [
              { cartodb_id: 1, title: '1st', the_geom: '' },
              { cartodb_id: 2, title: '2nd', the_geom: 'line' },
              { cartodb_id: 3, title: '3rd', the_geom: 'line' }
            ]
          });
        });

        it('should change status', function () {
          expect(this.model.get('status')).toEqual('fetched');
        });

        it('should setup raw geom', function () {
          expect(this.model.get('simple_geom')).toEqual(jasmine.any(String));
        });
      });

      describe('when request fails', function () {
        beforeEach(function () {
          Backbone.Model.prototype.sync.calls.argsFor(0)[2].error({
            responseText: '{"error": ["meh"]}'
          });
        });

        it('should have unavailable status', function () {
          expect(this.model.get('status')).toEqual('unavailable');
        });
      });

      describe('when request is aborted', function () {
        beforeEach(function () {
          Backbone.Model.prototype.sync.calls.argsFor(0)[2].error({
            statusText: 'abort'
          });
        });

        it('should not have anavailable status if error comes from an abort request', function () {
          expect(this.model.get('status')).not.toEqual('unavailable');
          expect(this.model.get('query_errors')).toBeUndefined();
        });
      });
    });
  });

  describe('when ready flag is changed', function () {
    describe('when there is no query', function () {
      beforeEach(function () {
        this.model.set('ready', true);
      });

      it('should change status', function () {
        expect(this.model.get('status')).toEqual('unavailable');
      });
    });

    describe('when there is a query', function () {
      beforeEach(function () {
        this.model.set({
          query: 'SELECT * FROM something',
          ready: false
        });
      });

      it('should change status', function () {
        expect(this.model.get('status')).toEqual('unfetched');
      });
    });
  });

  describe('.destroy', function () {
    beforeEach(function () {
      this.destroySpy = jasmine.createSpy('destroy');
      this.model.once('destroy', this.destroySpy);

      this.model.destroy();
    });

    it('should do default destroy process to cleanup bindings', function () {
      expect(this.destroySpy).toHaveBeenCalled();
    });
  });
});
