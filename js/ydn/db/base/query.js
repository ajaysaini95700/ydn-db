// Copyright 2012 YDN Authors. All Rights Reserved.
//
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
 * @fileoverview Query object.
 *
 * Define database query declaratively.
 */


goog.provide('ydn.db.Query');
goog.require('goog.functions');
goog.require('ydn.db.KeyRange');
goog.require('ydn.db.schema.Database');
goog.require('ydn.error.ArgumentException');
goog.require('ydn.math.Expression');
goog.require('ydn.string');



/**
 * @param {string=} sql_statement The sql statement.
 * @constructor
 */
ydn.db.Query = function(sql_statement) {
  // Note for V8 optimization, declare all properties in constructor.
  if (goog.isDef(sql_statement) && !goog.isString(sql_statement)) {
    throw new ydn.error.ArgumentException();
  }

  this.sql = '';
  if (goog.isDef(sql_statement)) {
    this.sql = sql_statement;
    //this.parseSql(sql_statement);
  }

  this.store_name = '';
  this.wheres_ = [];
  this.reduce_ = null;
  this.map_ = null;
  this.direction = undefined;
  this.index = undefined;
  this.limit_ = NaN;
  this.offset_ = NaN;
};


/**
 *
 * @type {string}
 */
ydn.db.Query.prototype.store_name = '';


/**
 *
 * @type {string|undefined}
 */
ydn.db.Query.prototype.index = undefined;


/**
 *
 * @type {ydn.db.Cursor.Direction|undefined}
 */
ydn.db.Query.prototype.direction = undefined;



/**
 * @private
 * @type {number}
 */
ydn.db.Query.prototype.limit_ = NaN;

/**
 * @private
 * @type {number}
 */
ydn.db.Query.prototype.offset_ = NaN;



/**
 * @private
 * @type {!Array.<!ydn.db.Where>} where clauses.
 */
ydn.db.Query.prototype.wheres_ = [];



/**
 * @private
 * @type {ydn.db.Query.Aggregate?} reduce function.
 */
ydn.db.Query.prototype.reduce_ = null;



/**
 * @private
 * @type {ydn.db.Query.Map?} map function.
 */
ydn.db.Query.prototype.map_ = null;


/**
 * @protected
 * @param {string} sql sql statement to parse.
 * @return {{
 *    action: string,
 *    fields: (string|!Array.<string>|undefined),
 *    store_name: string,
 *    wheres: !Array.<string>
 *  }} functional equivalent of SQL.
 * @throws {ydn.error.ArgumentException}
 */
ydn.db.Query.prototype.parseSql = function(sql) {
  var from_parts = sql.split(/\sFROM\s/i);
  if (from_parts.length != 2) {
    throw new ydn.error.ArgumentException('FROM required.');
  }

  // Parse Pre-FROM
  var pre_from_parts = from_parts[0].match(
    /\s*?(SELECT|COUNT|MAX|AVG|MIN|CONCAT)\s*(.*)/i);
  if (pre_from_parts.length != 3) {
    throw new ydn.error.ArgumentException('Unable to parse: ' + sql);
  }
  var action = pre_from_parts[1].toUpperCase();
  var action_arg = pre_from_parts[2].trim();
  var fields = undefined;
  if (action_arg.length > 0 && action_arg != '*') {
    if (action_arg[0] == '(') {
      action_arg = action_arg.substring(1);
    }
    if (action_arg[action_arg.length - 2] == ')') {
      action_arg = action_arg.substring(0, action_arg.length - 2);
    }
    if (action_arg.indexOf(',') > 0) {
      fields = ydn.string.split_comma_seperated(action_arg);
      fields = goog.array.map(fields, function(x) {
        return goog.string.stripQuotes(x, '"');
      });
    } else {
      fields = action_arg;
    }
  }

  // Parse FROM
  var parts = from_parts[1].trim().match(/"(.+)"\s*(.*)/);
  if (!parts) {
    throw new ydn.error.ArgumentException('store name required.');
  }
  var store_name = parts[1];
  var wheres = [];
  if (parts.length > 2) {
    wheres.push(parts[2]);
  }



  return {
    action: action,
    fields: fields,
    store_name: store_name,
    wheres: wheres
  };
};


/**
 * @private
 * @type {string} sql statement.
 */
ydn.db.Query.prototype.sql_ = '';


/**
 * @inheritDoc
 */
ydn.db.Query.prototype.toJSON = function() {
  return {
    'sql': this.sql_
  };
};


/**
 *
 * @param {string} store_name  store name to query from.
 * @return {ydn.db.Query} this query for chaining.
 */
ydn.db.Query.prototype.from = function(store_name) {
  this.store_name = store_name;
  return this;
};


/**
 *
 * @param {boolean} value if <code>true</code>,  the cursor should not yield
 * records with the same key.
 * @return {ydn.db.Query} this query for chaining.
 */
ydn.db.Query.prototype.unique = function(value) {
  if (this.direction == ydn.db.Cursor.Direction.NEXT ||
    this.direction == ydn.db.Cursor.Direction.NEXT_UNIQUE) {
    this.direction = !!value ? ydn.db.Cursor.Direction.NEXT_UNIQUE :
      ydn.db.Cursor.Direction.NEXT;
  } else {
    this.direction = !!value ? ydn.db.Cursor.Direction.PREV_UNIQUE :
      ydn.db.Cursor.Direction.PREV;
  }
  return this;
};


/**
 *
 * @param {boolean} value if <code>true</code>,  the cursor should yield
 * monotonically decreasing order of keys..
 * @return {ydn.db.Query} this query for chaining.
 */
ydn.db.Query.prototype.reverse = function(value) {
  if (this.direction == ydn.db.Cursor.Direction.NEXT_UNIQUE ||
    this.direction == ydn.db.Cursor.Direction.PREV_UNIQUE) {
    this.direction = !!value ? ydn.db.Cursor.Direction.PREV_UNIQUE :
      ydn.db.Cursor.Direction.NEXT_UNIQUE;
  } else {
    this.direction = !!value ? ydn.db.Cursor.Direction.PREV :
      ydn.db.Cursor.Direction.NEXT;
  }
  return this;
};


/**
 *
 * @param {string} index name of index to order.
 */
ydn.db.Query.prototype.order = function(index) {
  this.index = index;
};


/**
 * Convenient method for SQL <code>WHERE</code> predicate.
 * @param {string} field index field name to query from.
 * @param {string} op where operator.
 * @param {string} value rvalue to compare.
 * @param {string=} op2 secound operator.
 * @param {string=} value2 second rvalue to compare.
 * @return {!ydn.db.Query} The query.
 */
ydn.db.Query.prototype.where = function(field, op, value, op2, value2) {

  var already = goog.array.some(this.wheres_, function(x) {
    return x.field === field;
  });

  if (already) {
    throw new ydn.error.ArgumentException(field);
  }

  var upper, lower, upperOpen, lowerOpen;
  if (op == '<' || op == '<=') {
    upper = value;
    upperOpen = op == '<';
  } else if (op == '>' || op == '>=') {
    lower = value;
    lowerOpen = op == '>';
  } else if (op == '=' || op == '==') {
    lower = value;
    upper = value;
  }
  if (op2 == '<' || op2 == '<=') {
    upper = value2;
    upperOpen = op2 == '<';
  } else if (op2 == '>' || op2 == '>=') {
    lower = value2;
    lowerOpen = op2 == '>';
  } else if (goog.isDef(op2)) {
    throw new ydn.error.ArgumentException(op2);
  }


  this.wheres_.push(new ydn.db.Where(field, lower, upper, lowerOpen,
    upperOpen));

  return this;

};


/**
 *
 *   expression: (ydn.math.Expression|undefined),
 *
 * @typedef {{
 *   type: ydn.db.Query.MapType,
 *   fields: (!Array.<string>|string)
 * }}
 */
ydn.db.Query.Map;



/**
 * @enum {string}
 */
ydn.db.Query.MapType = {
  SELECT: 'sl',
  EXPRESSION: 'ex'
};



/**
 * @enum {string}
 */
ydn.db.Query.AggregateType = {
  COUNT: 'ct',
  SUM: 'sm',
  AVERAGE: 'av',
  MAX: 'mx',
  MIN: 'mn',
  SELECT: 'sl',
  CONCAT: 'cc',
  EXPRESSION: 'ex'
};


/**
 * @typedef {{
 *   type: ydn.db.Query.AggregateType,
 *   field: (string|undefined)
 * }}
 */
ydn.db.Query.Aggregate;


//
///**
// * Convenient method for SQL <code>COUNT</code> method.
// * @return {!ydn.db.Query} The query.
// */
//ydn.db.Query.prototype.count = function() {
//
//  if (this.reduce_) {
//    throw new ydn.error.ConstrainError('Aggregate method already defined.');
//  }
//  this.reduce_ = {type: ydn.db.Query.AggregateType.COUNT, field: undefined};
//  return this;
//
//};



/**
 * Return reduce iteration function for SUM
 * @param {string=} field field name.
 * @return {Function} count.
 */
ydn.db.Query.reduceCount = function(field) {
  return function(prev) {
    if (!prev) {
      prev = 0;
    }
    return prev + 1;
  };
};
//
//
///**
// * Convenient method for SQL <code>SUM</code> method.
// * @param {string} field name.
// * @return {!ydn.db.Query} The query for chaining.
// */
//ydn.db.Query.prototype.sum = function(field) {
//
//  if (this.reduce_) {
//    throw new ydn.error.ConstrainError('Aggregate method already defined.');
//  }
//  this.reduce_ = {
//    type: ydn.db.Query.AggregateType.SUM,
//    field: field
//  };
//  return this;
//
//
//};


/**
 * Return reduce iteration function for SUM
 * @param {string} field field name.
 * @return {Function} sum.
 */
ydn.db.Query.reduceSum = function(field) {
  return function(prev, curr, i) {
    if (!goog.isDef(prev)) {
      prev = 0;
    }
    return prev + curr[field];
  };
};


/**
 * Return reduce iteration function for MIN
 * @param {string} field name.
 * @return {Function} min.
 */
ydn.db.Query.reduceMin = function(field) {
  return function(prev, curr, i) {
    var x = curr[field];
    if (!goog.isDef(prev)) {
      return x;
    }
    return prev < x ? prev : x;
  };
};


/**
 * Return reduce iteration function for MAX
 * @param {string} field name.
 * @return {Function} max.
 */
ydn.db.Query.reduceMax = function(field) {
  return function(prev, curr, i) {
    var x = curr[field];
    if (!goog.isDef(prev)) {
      return x;
    }
    return prev > x ? prev : x;
  };
};


//
//
///**
// * Convenient method for SQL <code>AVERAGE</code> method.
// * @param {string} field name.
// * @return {!ydn.db.Query} The query for chaining.
// */
//ydn.db.Query.prototype.average = function(field) {
//
//  if (this.reduce_) {
//    throw new ydn.error.ConstrainError('Aggregate method already defined.');
//  }
//  this.reduce_ = {
//    type: ydn.db.Query.AggregateType.AVERAGE,
//    field: field
//  };
//  return this;
//
//
//};


/**
 * Return reduce iteration function for AVERAGE
 * @param {string} field name.
 * @return {Function} average.
 */
ydn.db.Query.reduceAverage = function(field) {
  return function(prev, curr, i) {
    if (!goog.isDef(prev)) {
      prev = 0;
    }
    return (prev * i + curr[field]) / (i + 1);
  };
};


/**
 *
 * @param {(string|ydn.math.Expression)=} opt_method selection method.
 * @param {string=} fields field names to select.
 * @return {!ydn.db.Query} The query for chaining.
 */
ydn.db.Query.prototype.reduce = function(opt_method, fields) {

  if (this.reduce_) {
    throw new ydn.error.ArgumentException('too many reduce.');
  }
  var method = '';
  if (opt_method instanceof ydn.math.Expression) {
    var exp = opt_method;

      this.reduce_ = /** @type {ydn.db.Query.Aggregate} */ ({
        type: ydn.db.Query.AggregateType.EXPRESSION,
        fields: ''
      }); // why casting ??

    return this;
  } else if (goog.isString(opt_method)) {
    method = opt_method.toLowerCase();
  } else {
    throw new ydn.error.ArgumentException();
  }


  if (method == 'avg') {

    if (!goog.isString(fields)) {
      throw new ydn.error.ArgumentException('AVG');
    }
    this.reduce_ = {
      type: ydn.db.Query.AggregateType.AVERAGE,
      field: fields
    };
  } else if (method == 'min') {

    if (!goog.isString(fields)) {
      throw new ydn.error.ArgumentException('MIN');
    }
    this.reduce_ = {
      type: ydn.db.Query.AggregateType.MIN,
      field: fields
    };
  } else if (method == 'max') {

    if (!goog.isString(fields)) {
      throw new ydn.error.ArgumentException('MAX');
    }
    this.reduce_ = {
      type: ydn.db.Query.AggregateType.MAX,
      expr: null,
      field: fields
    };
  } else if (method == 'sum') {

    if (!goog.isString(fields)) {
      throw new ydn.error.ArgumentException('SUM');
    }
    this.reduce_ = {
      type: ydn.db.Query.AggregateType.SUM,
      field: fields
    };
  } else if (method == 'count') {

    if (goog.isString(fields)) {
      this.reduce_ = {type: ydn.db.Query.AggregateType.COUNT, field: fields};
    } else if (goog.isDef(fields)) {
      throw new ydn.error.ArgumentException('COUNT');
    } else {
      this.reduce_ = {type: ydn.db.Query.AggregateType.COUNT, field: undefined};
    }
  } else {
    throw new ydn.error.ArgumentException('Unknown reduce method: ' +
      opt_method);
  }

  return this;
};


/**
 *
 * @param {string|ydn.math.Expression} opt_method selection method.
 * @param {(string|!Array.<string>)=} fields field names to select.
 * @return {!ydn.db.Query} The query for chaining.
 */
ydn.db.Query.prototype.map = function(opt_method, fields) {

  if (this.map_) {
    throw new ydn.error.ConstrainError('too many call.');
  }

  var method = '';
  if (opt_method instanceof ydn.math.Expression) {
    if (goog.isString(fields) || goog.isArray(fields)) {
    this.map_ = {
      type: ydn.db.Query.MapType.EXPRESSION,
      fields: fields
    };
    } else {
      throw new ydn.error.ArgumentException();
    }
  } else if (goog.isString(opt_method)) {
    method = opt_method.toLowerCase();
  } else {
    throw new ydn.error.ArgumentException();
  }

  if (method == 'select') {

    if (goog.isString(fields) || goog.isArray(fields)) {
      this.map_ = {
        type: ydn.db.Query.MapType.SELECT,
        fields: fields
      };
    } else {
      throw new ydn.error.ArgumentException('SELECT fields missing');
    }

  } else {
    throw new ydn.error.ArgumentException('Unknown query: ' + opt_method);
  }

  return this;
};





/**
 *
 * @param {!Array.<string>|string} fields field names.
 * @return {Function} select projection function.
 */
ydn.db.Query.mapSelect = function(fields) {
  return function(data) {
    if (goog.isString(fields)) {
      return data[fields];
    } else {
      var selected_data = {};
      for (var i = 0; i < fields.length; i++) {
        selected_data[fields[i]] = data[fields[i]];
      }
      return selected_data;
    }
  };
};


/**
 *
 * @return {string} store name.
 */
ydn.db.Query.prototype.getStoreName = function() {
  return this.store_name;
};



/**
 * Parse SQL statement and convert to cursor object for IndexedDB execution.
 * @see #toSqlCursor
 * @param {ydn.db.schema.Database} schema schema.
 * @return {!ydn.db.Cursor} cursor.
 */
ydn.db.Query.prototype.toCursor = function(schema) {


  if (this.store_name.length == 0) {
    throw new ydn.error.InvalidOperationException('store name not set.');
  }
  var store = schema.getStore(this.store_name);
  if (!store) {
    throw new ydn.error.InvalidOperationException('store: ' + this.store_name +
        ' not found.');
  }

  var key_range;
  var index = this.index;
  var direction = this.direction;

  // sniff index field
  if (!goog.isDef(this.index)) {
    for (var i = 0; i < this.wheres_.length; i++) {
      /**
       * @type {ydn.db.Where}
       */
      var where = this.wheres_[i];
      if (store.hasIndex(where.field)) {
        index = where.field;
        key_range = where;
        direction = direction || ydn.db.Cursor.Direction.NEXT;
        this.wheres_.splice(i, 1);
        break;
      }
    }
  }

  var cursor = new ydn.db.Cursor(this.store_name, direction, index, key_range);

  // then, process where clauses
  for (var i = 0; i < this.wheres_.length; i++) {
    cursor.processWhereAsFilter(this.wheres_[i]);
  }

  if (this.map_) {
    if (this.map_.type == ydn.db.Query.MapType.SELECT) {
      cursor.map_ = ydn.db.Query.mapSelect(this.map_.fields);
    } else {
      throw new ydn.db.SqlParseError(this.map_.type);
    }
  }

  if (this.reduce_) {
    if (this.reduce_.type == ydn.db.Query.AggregateType.SUM) {
      if (goog.isString(this.reduce_.field)) {
        cursor.reduce_ = ydn.db.Query.reduceSum(this.reduce_.field);
      } else {
        throw new ydn.db.SqlParseError('SUM: ' + this.sql_);
      }
    } else if (this.reduce_.type == ydn.db.Query.AggregateType.MIN) {
      if (goog.isString(this.reduce_.field)) {
        cursor.reduce_ = ydn.db.Query.reduceMin(this.reduce_.field);
      } else {
        throw new ydn.db.SqlParseError('MIN: ' + this.sql_);
      }
    } else if (this.reduce_.type == ydn.db.Query.AggregateType.MAX) {
      if (goog.isString(this.reduce_.field)) {
        cursor.reduce_ = ydn.db.Query.reduceMax(this.reduce_.field);
      } else {
        throw new ydn.db.SqlParseError('MAX: ' + this.sql_);
      }
    } else if (this.reduce_.type == ydn.db.Query.AggregateType.AVERAGE) {
      if (goog.isString(this.reduce_.field)) {
        cursor.reduce_ = ydn.db.Query.reduceAverage(this.reduce_.field);
      } else {
        throw new ydn.db.SqlParseError('AVERAGE: ' + this.sql_);
      }
    } else if (this.reduce_.type == ydn.db.Query.AggregateType.COUNT) {
      cursor.reduce_ = ydn.db.Query.reduceCount(this.reduce_.field);
    } else {
      throw new ydn.db.SqlParseError(this.sql_);
    }
  }

  //window.console.log([this, cursor]);
  return cursor;
};



/**
 *
 * @param {number} value limit value.
 */
ydn.db.Query.prototype.limit = function(value) {
  if (goog.isNumber(value) && value > 0) {
    this.limit_ = value;
  } else {
    throw new ydn.error.ArgumentException();
  }
};



/**
 *
 * @param {number} value offset value.
 */
ydn.db.Query.prototype.offset = function(value) {
  if (goog.isNumber(value) && value >= 0) {
    this.offset_ = value;
  } else {
    throw new ydn.error.ArgumentException();
  }
};


/**
 * Convert this query into iterable cursor object for WebSQL execution.
 * @see #toCursor
 * @param {!ydn.db.schema.Database} schema schema.
 * @return {!ydn.db.Cursor} cursor.
 */
ydn.db.Query.prototype.toSqlCursor = function(schema) {

  if (this.sql_.length > 0) {
    throw new ydn.error.NotImplementedException('SQL parser not implement');
  }
  if (this.store_name.length == 0) {
    throw new ydn.error.InvalidOperationException('store name not set.');
  }
  var store = schema.getStore(this.store_name);
  if (!store) {
    throw new ydn.error.InvalidOperationException('store: ' + this.store_name +
        ' not found.');
  }

  var cursor = new ydn.db.Cursor(this.store_name);
  var from = 'FROM ' + goog.string.quote(this.store_name);

  var select = '';
  var distinct = this.direction == ydn.db.Cursor.Direction.PREV_UNIQUE ||
    this.direction == ydn.db.Cursor.Direction.NEXT_UNIQUE;

  var fields_selected = false;
  if (goog.isDefAndNotNull(this.map_)) {
    if (this.map_.type == ydn.db.Query.MapType.SELECT) {
      var fs = goog.isArray(this.map_.fields) ?
        this.map_.fields : [this.map_.fields];
      var fields = goog.array.map(fs, function(x) {
        return goog.string.quote(x);
      });
      select += 'SELECT (' + fields.join(', ') + ')';
      fields_selected = true;
      // parse row and then select the fields.
      cursor.parseRow = ydn.db.Cursor.parseRowIdentity;
      cursor.map_ = ydn.db.Query.mapSelect(this.map_.fields);
    } else {
      throw new ydn.db.SqlParseError(this.map_ + ' in ' + this.sql_);
    }
  }
  if (goog.isDefAndNotNull(this.reduce_)) {
    if (this.reduce_.type == ydn.db.Query.AggregateType.COUNT) {
      select += 'SELECT COUNT (';
      select += distinct ? 'DISTINCT ' : '';
      if (goog.isString(this.reduce_.field)) {
        select += goog.string.quote(this.reduce_.field);
      } else {
        select += '*';
      }
      select += ')';
      fields_selected = true;
      // parse row and then select the fields.
      cursor.parseRow = ydn.db.Cursor.parseRowIdentity;
      cursor.map_ = ydn.object.takeFirst;
      cursor.finalize = ydn.db.Query.finalizeTakeFirst;
    } else if (this.reduce_.type == ydn.db.Query.AggregateType.SUM) {
      select += 'SELECT SUM (';
      select += distinct ? 'DISTINCT ' : '';
      if (goog.isString(this.reduce_.field)) {
        select += goog.string.quote(this.reduce_.field);
      } else {
        select += '*';
      }
      select += ')';
      fields_selected = true;
      // parse row and then select the fields.
      cursor.parseRow = ydn.db.Cursor.parseRowIdentity;
      cursor.map_ = ydn.object.takeFirst;
      cursor.finalize = ydn.db.Query.finalizeTakeFirst;
    } else if (this.reduce_.type == ydn.db.Query.AggregateType.AVERAGE) {
      select += 'SELECT AVG (';
      select += distinct ? 'DISTINCT ' : '';
      if (goog.isString(this.reduce_.field)) {
        select += goog.string.quote(this.reduce_.field);
      } else {
        select += '*';
      }
      select += ')';
      fields_selected = true;
      // parse row and then select the fields.
      cursor.parseRow = ydn.db.Cursor.parseRowIdentity;
      cursor.map_ = ydn.object.takeFirst;
      cursor.finalize = ydn.db.Query.finalizeTakeFirst;
    } else {
      throw new ydn.db.SqlParseError(this.reduce_.type + ' in ' + this.sql_);
    }
  }

  if (select.length == 0) {
    select += 'SELECT *' + (distinct ? ' DISTINCT' : '');
  }

  var where = '';
  for (var i = 0; i < this.wheres_.length; i++) {
    if (store.hasIndex(this.wheres_[i].field)) {
      if (where.length > 0) {
        where += ' AND ';
      } else {
        where += 'WHERE ';
      }
      var where_clause = this.wheres_[i].toWhereClause();
      where += where_clause.sql;
      if (where_clause.params.length > 0) {
        cursor.params = cursor.params.concat(where_clause.params);
      }
    } else {
      cursor.processWhereAsFilter(this.wheres_[i]);
    }
  }

  var field_name = goog.isDefAndNotNull(this.index) ?
    goog.string.quote(this.index) : goog.isDefAndNotNull(store.keyPath) ?
    goog.string.quote(store.keyPath) : ydn.db.base.SQLITE_SPECIAL_COLUNM_NAME;

  var order = 'ORDER BY ' + field_name;
  if (this.direction == ydn.db.Cursor.Direction.PREV ||
    this.direction == ydn.db.Cursor.Direction.PREV_UNIQUE) {
    order += ' DESC';
  } else {
    order += ' ASC';
  }

  var range = '';
  if (!isNaN(this.limit_)) {
    range += ' LIMIT ' + this.limit_;
  }

  if (!isNaN(this.offset_)) {
    range += ' OFFSET ' + this.offset_;
  }

  cursor.sql = select + ' ' + from + ' ' + where + ' ' + order + ' ' + range;
  return cursor;
};



/**
 * @override
 */
ydn.db.Query.prototype.toString = function() {
  if (goog.DEBUG) {
    return 'query:' + this.sql_;
  } else {
    return goog.base(this, 'toString');
  }
};


/**
 * Parse resulting object of a row
 * @final
 * @param {ydn.db.schema.Store} table table of concern.
 * @param {!Object} row row.
 * @return {*} the first field of object in row value.
 */
ydn.db.Query.parseRowTakeFirst = function(table, row) {
  for (var key in row) {
    if (row.hasOwnProperty(key)) {
      return row[key];
    }
  }
  return undefined;
};


/**
 *
 * @param {*} arr array.
 * @return {*} get the first element of an array.
 */
ydn.db.Query.finalizeTakeFirst = function(arr) {
  if (goog.isArray(arr)) {
    return arr[0];
  } else {
    return undefined;
  }
};

