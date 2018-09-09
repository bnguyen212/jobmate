let apiKey = document.getElementById('api-key');
let baseId = document.getElementById('base-id');
let tableName = document.getElementById('table-name');
let saveBtn = document.getElementById('save');
let closeBtn = document.getElementById('close');

chrome.storage.sync.get(["airtableApiKey", "airtableBaseId", "airtableTableName"], function(data) {
  apiKey.value = data.airtableApiKey ? data.airtableApiKey : '';
  baseId.value = data.airtableBaseId ? data.airtableBaseId : '';
  tableName.value = data.airtableTableName ? data.airtableTableName : '';
})

saveBtn.onclick = function(element) {
  const obj = {
    airtableApiKey: apiKey.value,
    airtableBaseId: baseId.value,
    airtableTableName: tableName.value
  }
  chrome.storage.sync.set(obj, function() {
    window.alert('Successfully saved!')
  })
}

closeBtn.onclick = function(element) {
  window.close();
}