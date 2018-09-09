var Airtable = require('airtable');

// Get a base ID for an instance of art gallery example
let airtableTableName, base;
chrome.storage.sync.get(["airtableApiKey", "airtableBaseId", "airtableTableName"], function(data) {
  airtableTableName = data.airtableTableName;
  base = new Airtable({ apiKey: data.airtableApiKey }).base(data.airtableBaseId);
})

let parseInfo = document.getElementById('parseInfo');
let saveBtn = document.getElementById('saveBtn');
let clearBtn = document.getElementById('clearBtn');

let jobTitle = document.getElementById('jobTitle');
let company = document.getElementById('company');
let jobLocation = document.getElementById('jobLocation');
let url = document.getElementById('url');
let saveDate = document.getElementById('saveDate');
let status = document.getElementById('status');
let notes = document.getElementById('notes');

parseInfo.onclick = function(e) {
  e.preventDefault();
  chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
    chrome.tabs.sendMessage(tabs[0].id, {action: "parse", url: tabs[0].url}, function(response) {
      if (response) {
        saveDate.value = moment().toISOString(true).slice(0,10);
        company.value = response.company;
        jobTitle.value = response.jobTitle;
        jobLocation.value = response.jobLocation;
        url.value = response.url;
        status.value = 'Submitted';
      }
    })
  })
}

clearBtn.onclick = function(e) {
  e.preventDefault();
  company.value = '';
  jobTitle.value = '';
  jobLocation.value = '';
  url.value = '';
  notes.value = '';
  status.value = '';
  saveDate.value = '';
}

saveBtn.onclick = function(e) {
  e.preventDefault();
  if (!jobTitle.value || !company.value || !jobLocation.value || !url) {
    return alert('Please enter information for all required fields')
  }
  const obj = {
    "Company": company.value,
    "Position": jobTitle.value,
    "URL": url.value,
    "Applied On": saveDate.value || moment().toISOString(true).slice(0,10),
    "Status": status.value,
    "Notes": notes.value,
    "Location": jobLocation.value
  }
  base(airtableTableName).create(obj, function(err, record) {
    if (err) return alert(err)
    alert('Saved on Airtable!')
  })
}