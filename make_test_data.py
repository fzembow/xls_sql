import random
import sys
import uuid

NUM_COLUMNS = 4

MAX_INT = 1024

def make_data(numrows):

  headings = ["\"id\""]
  for c in range(0, NUM_COLUMNS - 1):
    headings.append("\"data_" + str(unichr(c + 97)) + "\"")
  print ",".join(headings)

  for i in range(numrows):
    row = ["\"" + str(uuid.uuid4()) + "\""]
    for c in range(1, NUM_COLUMNS):
      row.append(str(random.randint(0, MAX_INT)))
    print ",".join(row)


if __name__ == "__main__":
  if len(sys.argv) != 2:
    print "Usage: python make_test_data.py {{numrows}}"
    sys.exit(1)
  numrows = int(sys.argv[1])
  make_data(numrows)
