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

parseInfo.onclick = function (e) {
  e.preventDefault();
  chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
    chrome.tabs.sendMessage(
      tabs[0].id,
      { action: 'parse', url: tabs[0].url },
      function (response) {
        if (response) {
          saveDate.value = moment().toISOString(true).slice(0, 10);
          company.value = response.company;
          jobTitle.value = response.jobTitle;
          jobLocation.value = response.jobLocation;
          url.value = response.url;
          status.value = 'Submitted';
        }
      }
    );
  });
};

openBtn.onclick = function (e) {
  e.preventDefault();
  chrome.storage.sync.get(['airtableSpreadsheetURL'], function (data) {
    var openUrl = (data.airtableSpreadsheetURL || '').trim();
    if (!openUrl) {
      return alert('Please set your Airtable spreadsheet URL in Options.');
    }
    chrome.tabs.create({ url: openUrl });
  });
};

clearBtn.onclick = function (e) {
  e.preventDefault();
  company.value = '';
  jobTitle.value = '';
  jobLocation.value = '';
  url.value = '';
  notes.value = '';
  status.value = '';
  saveDate.value = '';
};

saveBtn.onclick = function (e) {
  e.preventDefault();
  if (!jobTitle.value || !company.value || !jobLocation.value || !url.value) {
    return alert('Please enter information for all required fields');
  }
  chrome.storage.sync.get(
    ['airtableAccessToken', 'airtableSpreadsheetURL'],
    function (data) {
      var accessToken = data.airtableAccessToken;
      var parsed = parseAirtableSpreadsheetUrl(
        (data.airtableSpreadsheetURL || '').trim()
      );
      if (!accessToken || !parsed.ok) {
        return alert(
          'Please set your access token and spreadsheet URL in Options (open your jobs table in Airtable and paste that URL).'
        );
      }
      var base = new Airtable({ apiKey: accessToken }).base(parsed.baseId);
      var obj = {
        Company: company.value,
        Position: jobTitle.value,
        URL: url.value,
        'Applied On': saveDate.value || moment().toISOString(true).slice(0, 10),
        Status: status.value,
        Notes: notes.value,
        Location: jobLocation.value,
      };
      base(parsed.tableIdOrName).create(obj, function (err, record) {
        if (err) return alert(err);
        alert('Saved on Airtable!');
      });
    }
  );
};
