var sql = window.SQL;

var VALID_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/csv",
];

// How many rows to show in a table by default.
var ROWS_TO_SHOW = 6;

// Ember stuff.
App = Ember.Application.create();

App.Router.map(function() {
});

App.Session = Ember.Object.extend({
  query: "SELECT COUNT(*) FROM data",
  results: Ember.A([])
});

App.Result = Ember.Object.extend({
  query: "",
  result: "",
  error: ""
});

App.IndexRoute = Ember.Route.extend({
  model: function(){
    return App.Session.create();
  },
  setupController : function(controller, model){
    controller.set("model", model);
  }
});

App.IndexController = Ember.ObjectController.extend({

  actions: {
    // Called when the selected file is changed.
    fileSelectionChangedAction: function(e){

      var file = $("#fileinput")[0].files[0];
      var name = file.name;
      var size = file.size;
      // TODO: Reject files here that are too large.
      var type = file.type;

      if (VALID_TYPES.indexOf(type) != -1) {
        this.set("hasFile", true);
      } else {
        // TODO: Replace this with a nicer dialog.
        alert("Only .csv, .xls, and .xlsx files are currently supported");
      }
      return false;
    },

    // Called when the file is uploaded.
    uploadFileAction: function(){
      var formData = new FormData($("#fileform")[0]);
      console.time('upload');
      $.ajax({
        url: '',
        type: 'POST',
        success: this.onUploadCompleted.bind(this),
        error: this.onUploadError.bind(this),
        data: formData,
        cache: false,
        contentType: false,
        processData: false
      });
      return false;
    },

    // Called when the user initiates a query.
    runQueryAction: function(){
      this.execUserQuery(this.get('query'));
      return false;
    },

    // Adds a column or table to the query.
    addToQueryAction: function(val){
      // TODO: This should be conscious of cursor position in the textarea.
      this.set('query', this.get('query') + ' ' + columnName(val));
      return false;
    },
  },

  // Called when a file upload fails.
  onUploadError: function(err){
    console.timeEnd('upload');
    // TODO: Handle errors more gracefully.
    alert("Error in uploading file");
  },

  // Called when a file upload succeeds.
  onUploadCompleted: function(data){
    console.timeEnd('upload');

    this.set('data', data);
    console.time('populate DB');
    this.sqlWorker.postMessage({
      id: 'populate',
      action: 'exec',
      sql: getDBInitStatement(data)
    });

    this.set('pendingWorkerRequest', true);
  },

  // SQLLite WebWorker
  sqlWorker: new Worker("js/worker.sql.js"),

  // Sets up communication with the worker on initialization.
  initWorker: function(){

    var worker = this.sqlWorker;
    // When the first message is recieved, and the DB has been
    // initialized, let the app listen to query results.
    worker.onmessage = (function(m){
      console.log("DB Initialized");
      worker.onmessage = this.onWorkerResult.bind(this);
    }).bind(this);

    worker.onerror = this.onWorkerError.bind(this);

    // Initiate the database.
    worker.postMessage({
      id: 'open',
      action: 'open'
    });
  }.on('init'),

  // Executes an SQL statement on the worker on behalf of the user.
  execUserQuery: function(sql){

    if (this.pendingWorkerRequest) {
      console.log("Error: there's already a pending worker request");
      return;
    }

    var queryId = ++this.queryId;
    this.userQueries[queryId] = sql;
    console.time('execute query ' + queryId);

    this.sqlWorker.postMessage({
      id: queryId,
      action: 'exec',
      sql: sql
    });

    this.set('pendingWorkerRequest', true);
  },

  // Called when a query result is returned by the worker.
  onWorkerResult: function(message){
    this.set('pendingWorkerRequest', false);

    var queryId = message.data.id;
    if (!this.userQueries[queryId]) {
      console.timeEnd('populate DB');
      return;
    }

    console.timeEnd('execute query ' + queryId);

    var query = this.userQueries[queryId];

    var results = message.data.results;
    if (results.length){
      this.get('results').insertAt(0, {
        query: query,
        data: results[0],
      });
    } else {
      this.get('results').insertAt(0, {
        query: query,
        error: "No results",
      });
    }
  },

  // Called when the worker hits an error.
  onWorkerError: function(e){
    this.set('pendingWorkerRequest', false);
    var queryId = this.queryId;
    console.timeEnd('execute query ' + queryId);

    this.get('results').insertAt(0, {
      query: this.userQueries[queryId],
      error: e.message
    });
  },

  // Associate query IDs with the statements used to create them
  userQueries: {},

  // How many userQueries have been run.
  queryId: 0,

  // Whether there's a pending request.
  pendingWorkerRequest: false

});


App.DataTableComponent = Ember.Component.extend({

  actions: {
    collapseAction: function(){
      var tbody = this.element.querySelector("table.datatable tbody");
      var rows = tbody.children;
      for (var i = ROWS_TO_SHOW; i < rows.length; i++) {
        rows[i].classList.add('hidden');
      }
      this.set('isCollapsed', true);
    },

    expandAction: function(){
      var hiddenRows = this.element.querySelectorAll("table.datatable tbody tr.hidden");
      for (var i = 0; i < hiddenRows.length; i++) {
        hiddenRows[i].classList.remove('hidden');
      }
      this.set('isCollapsed', false);
    },
  },

  // Whether this table has been truncated and can be expanded.
  isCollapsible: function(){
    return this.get('data').values.length >= ROWS_TO_SHOW;
  }.property('data'),

  // Whether the table is currently collapsed.
  isCollapsed: true,

  // The table is rendered manually and not using templates so that it's way faster.
  willInsertElement: function(){

    console.time('rendering table');

    var data = this.get('data');

    var theadRow = this.element.querySelector("table.datatable thead tr");
    for (var i = 0; i < data.columns.length; i++) {
      var th = document.createElement('th');
      th.textContent = columnName(data.columns[i]);
      theadRow.appendChild(th);
    }

    var values = data.values;
    var tbody = document.createElement('tbody');
    for (var i = 0; i < values.length; i++) {
      var row = values[i];
      var tr = document.createElement('tr');
      for (var j = 0; j < row.length; j++) {
        var td = document.createElement('td');
        td.textContent = row[j];
        tr.appendChild(td);
      }

      if (i >= ROWS_TO_SHOW) {
        tr.classList.add('hidden');
      }
      tbody.appendChild(tr);
    }

    var table = this.element.querySelector("table.datatable");
    table.appendChild(tbody);
    console.timeEnd('rendering table');
  }
});


// Escapes text for use as a column name.
function columnName(text){
  return text.replace(/[^A-Za-z0-9]+/g, '_');
}

Ember.Handlebars.helper('columnName', function(value, opts) {
  return columnName(value);
});


// Returns an object mapping column indices to types [int, char].
function getColumnTypes(data){
  var types = [];
  var header = data.columns;
  for (var i = 0; i < header.length; i++) {
    types.push({
      name: columnName(header[i]),
      type: 'float'
    });
  }

  // Assume everything is a float unless we hit a non-number, in which
  // case we just treat it as text.
  for (var i = 1; i < data.length; i++){
    var row = data[i];
    for (var x = 0; x < row.length; x++){
      if (typeof row[x] == 'string') {
        types[x].type = 'char';
      }
    }
  }
  return types;
}

// Reference to the SQLLite database (in memory).
function getDBInitStatement(data){
  var cols = getColumnTypes(data);

  var sqlstr = "CREATE TABLE data ("
  sqlstr += cols.map(function(c){
    return c.name + " " + c.type;
  }).join(', ');
  sqlstr += ");";

  var values = data.values;
  for (var i = 0; i < values.length; i++) {
    sqlstr += "INSERT INTO data VALUES (";
    sqlstr += values[i].map(function(d){
      if (typeof(d) == 'string') {
        return '"' + d.replace(/"/g, '""') + '"';
      }
      return d;
    }
    ).join(", ");
    sqlstr += ");"
  }
  return sqlstr;
}
