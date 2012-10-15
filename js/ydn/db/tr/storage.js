// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS-IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.


/**
 * @fileoverview Provide parallel transaction runner.
 *
 * @author kyawtun@yathit.com (Kyaw Tun)
 */

goog.provide('ydn.db.tr.Storage');
goog.require('ydn.db.con.Storage');
goog.require('ydn.db.tr.IStorage');
goog.require('ydn.db.tr.TxStorage');



/**
 * Create storage providing method to run in transaction.
 *
 * @param {string=} opt_dbname database name.
 * @param {!ydn.db.DatabaseSchema|DatabaseSchema=} opt_schema database schema
 * or its configuration in JSON format. If not provided, default empty schema
 * is used.
 * schema used in chronical order.
 * @param {!StorageOptions=} opt_options options.
 * @implements {ydn.db.tr.IStorage}
 * @extends {ydn.db.con.Storage}
 * @constructor
 */
ydn.db.tr.Storage = function(opt_dbname, opt_schema, opt_options) {
  goog.base(this, opt_dbname, opt_schema, opt_options);
  this.ptx_no = 0;
};
goog.inherits(ydn.db.tr.Storage, ydn.db.con.Storage);
//
//
///**
// * @override
// */
//ydn.db.tr.Storage.prototype.createDbInstance = function(db_type, db_name, config) {
//  //noinspection JSValidateTypes
//  if (db_type == ydn.db.con.IndexedDb.TYPE) {
//    return new ydn.db.tr.IndexedDb(db_name, config);
//  } else if (db_type == ydn.db.con.WebSql.TYPE) {
//    return new ydn.db.tr.WebSql(db_name, config);
//  } else if (db_type == ydn.db.con.LocalStorage.TYPE) {
//    return new ydn.db.tr.LocalStorage(db_name, config);
//  } else if (db_type == ydn.db.con.SessionStorage.TYPE) {
//    return new ydn.db.tr.SessionStorage(db_name, config);
//  } else if (db_type == ydn.db.con.SimpleStorage.TYPE)  {
//    return new ydn.db.tr.SimpleStorage(db_name, config);
//  }
//  return null;
//};


/**
 *
 * @type {number}
 * @protected
 */
ydn.db.tr.Storage.prototype.ptx_no = 0;


/**
 * @inheritDoc
 */
ydn.db.tr.Storage.prototype.getQueueNo = function() {
  // this must be base storage
  return 0;
};


/**
 * @inheritDoc
 */
ydn.db.tr.Storage.prototype.getTxNo = function() {
  return this.ptx_no;
};


/**
 * @protected
 * @param {string} scope_name
 * @return {!ydn.db.tr.TxStorage}
 */
ydn.db.tr.Storage.prototype.newTxInstance = function(scope_name) {
  return new ydn.db.tr.TxStorage(this, this.ptx_no++, scope_name);
};



/**
 * Run a transaction.
 * @param {Function} trFn function that invoke in the transaction.
 * @param {!Array.<string>} store_names list of keys or
 * store name involved in the transaction.
 * @param {ydn.db.base.TransactionMode=} opt_mode mode, default to 'readonly'.
 * @param {function(ydn.db.base.TransactionEventTypes, *)=} oncompleted
 * @param {...} opt_args
 */
ydn.db.tr.Storage.prototype.run = function (trFn, store_names, opt_mode,
                                                    oncompleted, opt_args) {

  var scope_name = trFn.name || '';
  var tx_queue = this.newTxInstance(scope_name);
  if (arguments.length > 4) {
    var args = Array.prototype.slice.call(arguments, 4);
    var outFn = function () {
      // Postpend the bound arguments to the current arguments.
      var newArgs = Array.prototype.slice.call(arguments);
      //newArgs.unshift.apply(newArgs, args);
      newArgs = newArgs.concat(args);
      return trFn.apply(this, newArgs);
    };
    outFn.name = trFn.name;
    tx_queue.run(outFn, store_names, opt_mode, oncompleted);
  } else { // optional are strip
    tx_queue.run(trFn, store_names, opt_mode, oncompleted);
  }

};


