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
      queryDB(this.get('query'), this.onQueryResult.bind(this));
      return false;
    },

    // Adds a column or table to the query.
    addToQueryAction: function(val){
      this.set('query', this.get('query') + ' ' + columnName(val));
      return false;
    },
  },

  // Called when a file upload fails.
  onUploadError: function(err){
    // TODO: Handle errors more gracefully.
    alert("Error in uploading file");
  },

  // Called when a file upload succeeds.
  onUploadCompleted: function(data){
    this.set('data', data);
    populateDB(data);
    $("#query").fadeIn();
  },

  // Called when a query completes.
  onQueryResult: function(result){
    this.get('results').insertAt(0, result);
  },
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

    console.time('rendering table DOM');

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
    console.timeEnd('rendering table DOM');
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
var db;
function populateDB(data){

  console.time('populating DB');
  var cols = getColumnTypes(data);

  db = new sql.Database();

  sqlstr = "CREATE TABLE data ("
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
  db.run(sqlstr);

  console.timeEnd('populating DB');
}

// Query the DB.
function queryDB(query, callback){
  // TODO: Use db.prepare to use escaping
  try {
    var res = db.exec(query);
    if (!res || !res.length) {
      callback({
        query: query,
        error: "No results"
      });
      return;
    }
  } catch(err) {
    callback({
      query: query,
      error: err
    });
    return;
  }

  callback({
    query: query,
    data: res[0]
  });
}
