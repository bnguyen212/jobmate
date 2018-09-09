chrome.runtime.onInstalled.addListener(function() {

  chrome.browserAction.onClicked.addListener(function(tab) {
    chrome.storage.sync.get(["airtableApiKey", "airtableBaseId", "airtableTableName"], function(data) {
      if (!data.airtableApiKey || !data.airtableBaseId || !data.airtableTableName) {
        alert('Please set up your Airtable API key, base ID, and table name')
      } else {
        chrome.browserAction.setPopup({popup: "popup.html"});
      }
    })
  })

});
