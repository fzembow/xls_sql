var sql = window.SQL;

var VALID_TYPES = [
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
];

// Called when the page is initialized.
function init(){

  $("#fileinput").change(function(){
    var file = this.files[0];
    var name = file.name;
    var size = file.size;
    var type = file.type;

    if (VALID_TYPES.indexOf(type) != -1) {
      $("#filesubmit").fadeIn();
    } else {
      alert("Only .xls and .xlsx files are currently supported");
    }
  });

  $("#runquery").click(function(){
    queryDB($("#queryinput").val());
  });
}


// Called when the user uploads a new file.
function uploadFile(){
  var formData = new FormData($("#fileform")[0]);
  $.ajax({
    url: '',
    type: 'POST',
    success: onUploadCompleted,
    // error: errorHandler,
    // TODO: Handle errors.
    data: formData,
    cache: false,
    contentType: false,
    processData: false
  });
  return false;
}

// Called when the upload succeeds.
function onUploadCompleted(data){
  displayTable(data);
  $("#data").fadeIn();
  populateDB(data);
  $("#query").fadeIn();
}


function displayTable(data){
  var tableHeadRow = $("#datatable thead tr").html('');
  var firstRow = data[0];
  firstRow.forEach(function(d){
    tableHeadRow.append($("<th>").text(escapeColumnName(d)));
  });

  var tableBody = $("#datatable tbody").html('');
  for (var i = 1; i < data.length; i++) {
    var row = data[i];
    var rowEl = $("<tr>");
    row.forEach(function(d){
      rowEl.append($("<td>").text(d));
    });
    tableBody.append(rowEl);
  }
}


// Escapes text for use as a column name.
function escapeColumnName(text){
  return text.replace(/\s+/g, '_');
}

// Returns an object mapping column indices to types [int, char].
function getColumnTypes(data){
  var types = [];
  var header = data[0];
  for (var i = 0; i < header.length; i++) {
    types.push({
      name: escapeColumnName(header[i]),
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
  var cols = getColumnTypes(data);

  db = new sql.Database();

  sqlstr = "CREATE TABLE data ("
  sqlstr += cols.map(function(c){
    return c.name + " " + c.type;
  }).join(', ');
  sqlstr += ");";

  for (var i = 1; i < data.length; i++) {
    sqlstr += "INSERT INTO data VALUES (";
    sqlstr += data[i].map(function(d){
      if (typeof(d) == 'string') {
        return '"' + d + '"';
      }
      return d;
    }).join(", ");
    sqlstr += ");"
  }

  console.log(sqlstr);
  db.run(sqlstr);
}

// Query the DB.
function queryDB(query){

  console.log("Running query: " + query);

  // TODO: Use db.prepare to use escaping
  try {
    var res = db.exec(query);
    if (!res || !res.length) {
      logError(query, "No results");
      return;
    }
  } catch(err) {
    logError(query, err);
    return;
  }

  logResult(query, res);
}

// Logs a result to the DOM
function logResult(query, res){
  // TODO: Why are the results actually an array?
  var res = res[0];

  // TODO: Prettier result logging.
  var resultEl = $("<li>");
  resultEl.append($("<span class='query'>").text(query));
  resultEl.append($("<br>"));

  var table = $("<table>");

  var head = table.append("<thead>");
  res.columns.forEach(function(col){
    head.append($("<th>").text(col));
  });

  var body = table.append("<tbody>");
  res.values.forEach(function(row){
    var rowEl = $("<tr>");
    row.forEach(function(cell){
      rowEl.append($("<td>").text(cell));
    });
    body.append(rowEl);
  });

  resultEl.append(table);
  if (res.values.length > 1) {
    resultEl.append($("<span class='numrows'>").text(res.values.length + " rows"));
  }

  $("#resultslist").prepend(resultEl);
  $("#results").fadeIn();
}

// Logs an error to the DOM
function logError(query, err){
  var resultEl = $("<li>");
  resultEl.append($("<span class='query'>").text(query));
  resultEl.append($("<br>"));
  resultEl.append($("<span class='error'>").text(err));
  $("#resultslist").prepend(resultEl);
}

init();
