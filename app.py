import csv
import json
import os
import uuid
import xlrd
from flask import Flask, Response, request

DEBUG = True
UPLOAD_FOLDER = os.path.join(os.path.dirname(os.path.realpath(__file__)), "uploads")
ALLOWED_EXTENSIONS = set(['csv', 'xls', 'xlsx'])

app = Flask(__name__, static_url_path='')
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
app.config['MAX_CONTENT_LENGTH'] = 16 * 1024 * 1024
if DEBUG:
  app.debug = True

@app.route("/", methods=['POST', 'GET'])
def root():
  if request.method == 'GET':
    return app.send_static_file('index.html')
  elif request.method == 'POST':
    file = request.files['file']
    if file and allowed_file(file.filename):
      filetype = file.filename.rsplit('.', 1)[1]

      filename = str(uuid.uuid4())
      filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
      file.save(filepath)

      if filetype == 'csv':
        rows = get_csv_contents(filepath)
      else:
        rows = get_excel_contents(filepath)

      os.remove(filepath)

      res = {
        "columns": rows[0],
        "values": rows[1:]
      }
      return Response(json.dumps(res), mimetype='application/json')


# Gets the contents of a csv file.
def get_csv_contents(filename):
  f = open(filename, 'rb')
  reader = csv.reader(f)
  rows = list(reader)
  f.close()
  return rows


# Gets the contents of an excel file.
def get_excel_contents(filename, sheet_index=0):
  workbook = xlrd.open_workbook(filename)
  try:
    first_sheet_name = workbook.sheet_names()[sheet_index]
  except IndexError:
    print "Error: Can't access sheet %1 as workbook %s only has %i sheets" % (sheet_index, filename, len(workbook.sheet_names()))
    sys.exit(3)
  sheet = workbook.sheet_by_name(first_sheet_name)

  rows = []
  row = 0
  while row < sheet.nrows:
    cells = []
    for col in range(sheet.ncols):
      try:
        cells.append(sheet.cell_value(row, col))
      except IndexError:
        cells.append("")
    row += 1
    rows.append(cells);
  return rows

def allowed_file(filename):
  return '.' in filename and filename.rsplit('.', 1)[1] in ALLOWED_EXTENSIONS

if __name__ == "__main__":
  app.run()
