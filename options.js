let apiKey = document.getElementById('api-key');
let baseId = document.getElementById('base-id');
let tableName = document.getElementById('table-name');
let saveBtn = document.getElementById('save');

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
    $('h4').after('<div id="message">Successfully saved!</div>')
    setTimeout(function() {
      $('#message').fadeOut(500);
    }, 2000)
  })
}