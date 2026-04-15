const accessTokenInput = document.getElementById('access-token');
const spreadsheetUrlInput = document.getElementById('spreadsheet-url');
const saveBtn = document.getElementById('save');

function showSavedMessage() {
  document.getElementById('message')?.remove();
  const msg = document.createElement('div');
  msg.id = 'message';
  msg.textContent = 'Successfully saved!';
  document.querySelector('h4').insertAdjacentElement('afterend', msg);
  msg.style.opacity = '1';
  msg.style.transition = 'opacity 0.5s ease';
  setTimeout(() => {
    msg.style.opacity = '0';
    setTimeout(() => msg.remove(), 500);
  }, 2000);
}

saveBtn.addEventListener('click', () => {
  const parsed = parseAirtableSpreadsheetUrl(spreadsheetUrlInput.value);
  if (!parsed.ok) {
    alert(parsed.error);
    return;
  }
  chrome.storage.sync.set(
    {
      airtableAccessToken: accessTokenInput.value,
      airtableSpreadsheetURL: spreadsheetUrlInput.value.trim(),
    },
    showSavedMessage
  );
});

chrome.storage.sync.get(
  ['airtableAccessToken', 'airtableSpreadsheetURL'],
  (data) => {
    accessTokenInput.value = data.airtableAccessToken || '';
    spreadsheetUrlInput.value = (data.airtableSpreadsheetURL || '').trim();
  }
);
