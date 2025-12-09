const Airtable = require('airtable');

const parseInfo = document.getElementById('parseInfo');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const openBtn = document.getElementById('openBtn');

const jobTitle = document.getElementById('jobTitle');
const company = document.getElementById('company');
const jobLocation = document.getElementById('jobLocation');
const url = document.getElementById('url');
const saveDate = document.getElementById('saveDate');
const status = document.getElementById('status');
const notes = document.getElementById('notes');

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

openBtn.onclick = function(e) {
  e.preventDefault();
  chrome.storage.sync.get(["airtableBaseURL"], function (data) {
    if (!data.airtableBaseURL) {
      return alert('Please set up the Base URL to access your Airtable')
    } else {
      window.open(data.airtableBaseURL, '_blank')
    }
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
  chrome.storage.sync.get(["airtableApiKey", "airtableBaseId", "airtableTableName"], function(data) {
    if (!data.airtableApiKey || !data.airtableBaseId || !data.airtableTableName) {
      return alert('Please set up your Airtable API key, base ID, and table name')
    } else {
      const airtableTableName = data.airtableTableName;
      const base = new Airtable({ apiKey: data.airtableApiKey }).base(data.airtableBaseId);
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
  })
}