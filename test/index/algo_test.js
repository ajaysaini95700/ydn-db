
goog.require('goog.debug.Console');
goog.require('ydn.db.algo.NestedLoop');
goog.require('ydn.db.algo.ZigzagMerge');
goog.require('ydn.db.algo.SortedMerge');
goog.require('goog.testing.jsunit');

goog.require('ydn.db.Storage');



var reachedFinalContinuation, schema, debug_console, db, objs, animals;
var store_name = 't1';
var db_name = 'test_algo_1';

var setUp = function() {
  if (!debug_console) {
    debug_console = new goog.debug.Console();
    debug_console.setCapturing(true);
    goog.debug.LogManager.getRoot().setLevel(goog.debug.Logger.Level.WARNING);
    //goog.debug.Logger.getLogger('ydn.gdata.MockServer').setLevel(goog.debug.Logger.Level.FINEST);
    goog.debug.Logger.getLogger('ydn.db').setLevel(goog.debug.Logger.Level.FINEST);
    //goog.debug.Logger.getLogger('ydn.db.con').setLevel(goog.debug.Logger.Level.FINEST);
    //goog.debug.Logger.getLogger('ydn.db.req').setLevel(goog.debug.Logger.Level.FINEST);

    //ydn.db.tr.Mutex.DEBUG = true;
    //ydn.db.core.req.IndexedDb.DEBUG = true;
    ydn.db.algo.SortedMerge.DEBUG = true;
  }

  var indexSchema = new ydn.db.schema.Index('tag', ydn.db.schema.DataType.TEXT, false, true);
  var valueIndex = new ydn.db.schema.Index('value', ydn.db.schema.DataType.NUMERIC, false, true);
  var xIndex = new ydn.db.schema.Index('x', ydn.db.schema.DataType.NUMERIC, false, true);
  var store_schema = new ydn.db.schema.Store(store_name, 'id', false,
      ydn.db.schema.DataType.INTEGER, [valueIndex, indexSchema, xIndex]);

  var colorIndex = new ydn.db.schema.Index('color', ydn.db.schema.DataType.TEXT);
  var hornIndex = new ydn.db.schema.Index('horn', ydn.db.schema.DataType.TEXT);
  var legIndex = new ydn.db.schema.Index('legs', ydn.db.schema.DataType.TEXT);
  var anmialStore = new ydn.db.schema.Store('animals', 'id', false,
    ydn.db.schema.DataType.TEXT, [colorIndex, hornIndex, legIndex]);

  schema = new ydn.db.schema.Database(undefined, [store_schema, anmialStore]);
  db = new ydn.db.Storage(db_name, schema, options);


  objs = [
    {id: 0, value: Math.random(), x: 1, tag: ['a', 'b']},
    {id: 1, value: Math.random(), x: 2, tag: 'a'},
    {id: 2, value: Math.random(), x: 2, tag: ['a', 'b']},
    {id: 3, value: Math.random(), x: 3, tag: 'b'},
    {id: 4, value: Math.random(), x: 1, tag: ['b', 'c', 'd']},
    {id: 5, value: Math.random(), x: 1, tag: ['c']},
    {id: 6, value: Math.random(), x: 1}
  ];

  db.put(store_name, objs).addCallback(function (value) {
    console.log(db + 'store: ' + store_name + ' ready.');
  });

  animals = [
    {id: 'rat', color: 'brown', horn: 0, legs: 4},
    {id: 'cow', color: 'spots', horn: 1, legs: 4},
    {id: 'galon', color: 'gold', horn: 1, legs: 2},
    {id: 'snake', color: 'spots', horn: 0, legs: 0},
    {id: 'chicken', color: 'red', horn: 0, legs: 2}
  ];
  db.put('animals', animals).addCallback(function (value) {
    console.log(db + 'store: animals ready.');
  });


  reachedFinalContinuation = false;
};

var tearDown = function() {
  db.close();
  assertTrue('The final continuation was not reached', reachedFinalContinuation);
};


var match_animal = function(algo) {

  var done;

  waitForCondition(
    // Condition
    function () {
      return done;
    },
    // Continuation
    function () {
      assertArrayEquals('result', ['cow'], out);
      reachedFinalContinuation = true;

    },
    100, // interval
    1000); // maxTimeout

  var q1 = ydn.db.Iterator.where('animals', 'color', '=', 'spots');
  var q2 = ydn.db.Iterator.where('animals', 'horn', '=', 1);
  var q3 = ydn.db.Iterator.where('animals', 'legs', '=', 4);
  var out = [];

  var solver, req;
  if (algo == 'nested') {
    solver = new ydn.db.algo.NestedLoop(out);
  } else if (algo == 'zigzag') {
    solver = new ydn.db.algo.ZigzagMerge(out);
  } else if (algo == 'sorted') {
    solver = new ydn.db.algo.SortedMerge(out);
  }

  req = db.scan([q1, q2, q3], solver);
  req.addCallback(function (result) {
    //console.log(result);

    done = true;
  });
  req.addErrback(function (e) {
    console.log(e);
    done = true;
  });
};


var test_nested_loop_1 = function () {
  match_animal('nested');
};


var test_zigzag_merge_1 = function () {
  match_animal('zigzag');
};



var test_sorted_merge_1 = function () {
  match_animal('sorted');
};



var match_objs = function(algo) {

  var done;
  var result_keys = [];
  var results = [0, 4];

  waitForCondition(
    // Condition
    function () {
      return done;
    },
    // Continuation
    function () {
      assertArrayEquals('result', results, result_keys);
      reachedFinalContinuation = true;

    },
    100, // interval
    1000); // maxTimeout

  var q1 = ydn.db.Iterator.where(store_name, 'x', '=', 1);
  var q2 = ydn.db.Iterator.where(store_name, 'tag', '=', 'b');

  var solver, req;
  if (algo == 'nested') {
    solver = new ydn.db.algo.NestedLoop(result_keys);

  } else if (algo == 'zigzag') {
    solver = new ydn.db.algo.ZigzagMerge(result_keys);

  } else if (algo == 'sorted') {
    solver = new ydn.db.algo.SortedMerge(result_keys);

  }

  req = db.scan([q1, q2], solver);

  req.addCallback(function (result) {
    //console.log(result);
    done = true;
  });
  req.addErrback(function (e) {
    console.log(e);
    done = true;
  });
};


var test_nested_loop_2 = function () {
  match_objs('nested');
};


var test_zigzag_merge_2 = function () {
  match_objs('zigzag');
};


var test_sorted_merge_2 = function () {
  match_objs('sorted');
};


var testCase = new goog.testing.ContinuationTestCase();
testCase.autoDiscoverTests();
G_testRunner.initialize(testCase);



