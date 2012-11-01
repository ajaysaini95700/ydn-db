/**
* @fileoverview Provide database query operations.
*
*
*/


goog.provide('ydn.db.TxStorage');
goog.require('ydn.db.core.TxStorage');
goog.require('ydn.db.req.IndexedDb');
goog.require('ydn.db.req.SimpleStore');
goog.require('ydn.db.req.WebSql');
goog.require('ydn.error.NotSupportedException');




/**
 * @param {!ydn.db.Storage} storage storage.
 * @param {number} ptx_no transaction queue number.
 * @param {string} scope_name scope name.
 * @param {!ydn.db.schema.Database} schema  schema.
 * @constructor
 * @extends {ydn.db.core.TxStorage}
*/
ydn.db.TxStorage = function(storage, ptx_no, scope_name, schema) {
  goog.base(this, storage, ptx_no, scope_name, schema);
};
goog.inherits(ydn.db.TxStorage, ydn.db.core.TxStorage);


/**
 * @const
 * @type {StoreSchema}
 */
ydn.db.TxStorage.KEY_VALUE_STORE_SCHEMA = /** @type {StoreSchema} */ ({
  'name': ydn.db.schema.Store.DEFAULT_TEXT_STORE,
  'keyPath': 'id',
  'type': ydn.db.schema.DataType.TEXT});


/**
 * Store a value to default key-value store.
 * @export
 * @param {string} key The key to set.
 * @param {string} value The value to save.
 * @param {number=} opt_expiration The number of miliseconds since epoch
 *     (as in goog.now()) when the value is to expire. If the expiration
 *     time is not provided, the value will persist as long as possible.
 * @return {!goog.async.Deferred} true on success. undefined on fail.
 */
ydn.db.TxStorage.prototype.setItem = function(key, value, opt_expiration) {

  var wrapper = this.getStorage().getWrapper();
  if (wrapper) {
    value = wrapper.wrapValue(key, value, opt_expiration);
  }
  var store = ydn.db.schema.Store.DEFAULT_TEXT_STORE;
  if (!this.schema.hasStore(ydn.db.schema.Store.DEFAULT_TEXT_STORE)) {
    if (this.schema.isAutoSchema()) {
      store = ydn.db.TxStorage.KEY_VALUE_STORE_SCHEMA;
    } else {
      throw new ydn.error.ArgumentException('key-value store not in used.');
    }
  }
  return this.put(store,
    {'id': key, 'value': value});

};



/**
 * Remove an item to default key-value store.
 * @export
 * @param {string} id item id to be remove.
 * @return {!goog.async.Deferred} true on success. undefined on fail.
 */
ydn.db.TxStorage.prototype.removeItem = function(id) {

  return this.clear(ydn.db.schema.Store.DEFAULT_TEXT_STORE, id);

};



/**
 * Retrieve a value from default key-value store.
 *
 * Note: This will not raise error to get non-existing object.
 * @export
 * @param {string} key The key to get.
 * @return {!goog.async.Deferred} return resulting object in deferred function.
 * If not found, {@code undefined} is return.
 */
ydn.db.TxStorage.prototype.getItem = function(key) {
  // if the table not exist, <code>get</code> will throw error.
  var out = this.get(ydn.db.schema.Store.DEFAULT_TEXT_STORE, key);
  var df = new goog.async.Deferred();
  var me = this;
  out.addCallback(function(data) {
    if (goog.isDef(data)) {
      var value = data['value'];
      var wrapper = me.getStorage().getWrapper();
      if (wrapper && goog.isDef(value)) {
        value = wrapper.unwrapValue(key, value);
      }
      df.callback(value);
    } else {
      df.callback(undefined);
    }
  });
  out.addErrback(function(data) {
    df.errback(data);
  });
  return df;
};



/**
 * @param {!ydn.db.Cursor} q query.
 * @param {function(*): boolean} clear clear iteration function.
 * @param {function(*): *} update update iteration function.
 * @param {function(*): *} map map iteration function.
 * @param {function(*, *, number=): *} reduce reduce iteration function.
 * @param {*} initial initial value for reduce iteration function.
 * @return {!goog.async.Deferred} promise.
 */
ydn.db.TxStorage.prototype.iterate = function(q, clear, update, map, reduce,
                                              initial) {
  var df = ydn.db.base.createDeferred();
  if (!(q instanceof ydn.db.Cursor)) {
    throw new ydn.error.ArgumentException();
  }

  var tr_mode = ydn.db.base.TransactionMode.READ_ONLY;
  if (goog.isDef(clear) || goog.isDef(update)) {
    tr_mode = ydn.db.base.TransactionMode.READ_WRITE;
  }

  var scope = goog.isDef(q.index) ?
    [q.index] : this.schema.getStoreNames();


  this.exec(function(executor) {
    executor.iterate(df, q, clear, update, map, reduce, initial);
  }, scope, tr_mode);

  return df;
};


/**
 * @param {!ydn.db.Cursor|!ydn.db.Query} q query.
 * @return {!goog.async.Deferred} return result as list.
 */
ydn.db.TxStorage.prototype.fetch = function(q) {

  var df = ydn.db.base.createDeferred();

  var query, cursor;
  if (q instanceof ydn.db.Query) {
    query = q;
    var store_name = query.getStoreName();
    var store = this.schema.getStore(store_name);
    if (!store) {
      throw new ydn.error.ArgumentException('store: ' + store_name +
        ' not exists.');
    }
    if (goog.isDefAndNotNull(query.index) && !store.hasIndex(query.index)) {
      throw new ydn.error.ArgumentException('Index: ' + query.index +
        ' not exists in store: ' + store_name);
    }

    this.exec(function(executor) {
      executor.fetchQuery(df, query);
    }, [store_name], ydn.db.base.TransactionMode.READ_ONLY);

  } else if (q instanceof ydn.db.Cursor) {
    cursor = q;
    this.exec(function(executor) {
      executor.fetchCursor(df, cursor);
    }, [cursor.store_name], ydn.db.base.TransactionMode.READ_ONLY);

  } else {
    throw new ydn.error.ArgumentException();
  }

  return df;
};


/** @override */
ydn.db.TxStorage.prototype.toString = function() {
  var s = 'TxStorage:' + this.getStorage().getName();
  if (goog.DEBUG) {
    var scope = this.getScope();
    scope = scope ? '[' + scope + ']' : '';
    var mu = this.getMuTx().getScope();
    var mu_scope = mu ? '[' + mu + ']' : '';
    return s + ':' + this.q_no_ + scope + ':' + this.getTxNo() + mu_scope;
  }
  return s;
};




