# Download Jos de Jong's JSONEditor libraries, a web-based GUI
# to edit JSON data structures.
#
# Grab the files directly from github.

cd `dirname $0`;
wget -nc https://raw.github.com/josdejong/jsoneditor/master/jsoneditor.{js,css}
mkdir -p img
cd img
wget -nc https://raw.github.com/josdejong/jsoneditor/master/img/jsoneditor-icons.png


