const apiKey = document.getElementById('api-key');
const baseId = document.getElementById('base-id');
const tableName = document.getElementById('table-name');
const baseURL = document.getElementById('base-url');
const saveBtn = document.getElementById('save');

chrome.storage.sync.get(["airtableApiKey", "airtableBaseId", "airtableTableName", "airtableBaseURL"], function(data) {
  apiKey.value = data.airtableApiKey ? data.airtableApiKey : '';
  baseId.value = data.airtableBaseId ? data.airtableBaseId : '';
  tableName.value = data.airtableTableName ? data.airtableTableName : '';
  baseURL.value = data.airtableBaseURL ? data.airtableBaseURL : '';
})

saveBtn.onclick = function(element) {
  const obj = {
    airtableApiKey: apiKey.value,
    airtableBaseId: baseId.value,
    airtableTableName: tableName.value,
    airtableBaseURL: baseURL.value
  }
  chrome.storage.sync.set(obj, function() {
    $('h4').after('<div id="message">Successfully saved!</div>')
    setTimeout(function() {
      $('#message').fadeOut(500);
    }, 2000)
  })
}