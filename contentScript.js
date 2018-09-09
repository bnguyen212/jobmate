chrome.runtime.onMessage.addListener(

  function(message, sender, callback) {
    if (message.action === 'parse') {
      const response = {};
      let jobTitle, company, jobLocation, url;
      url = message.url;

      if (message.url.includes('linkedin.com')) {

        jobTitle = $("h1").text();
        company = $('a.jobs-details-top-card__company-url').text().replace(/\n/g, '');
        jobLocation = $('span.jobs-details-top-card__bullet').first().text().replace(/\n/g, '');

      } else if (message.url.includes('greenhouse.io')) {

        jobTitle = $('.app-title').text();
        company = $('.company-name').text().replace(/\n/g, '').trim().split(' ', 2)[1];
        jobLocation = $('.location').text().replace(/\n/g, '');

      } else if (message.url.includes('lever.co')) {

        jobTitle = $('h2').text();
        company = $('title').text().split('-', 2)[0];
        jobLocation = $('.sort-by-time').text();

      } else if (message.url.includes('angel.co')) {

        jobTitle = $('h1').text().split('at')[0];
        company = $('h1').text().split('at')[1];
        jobLocation = $('.high-concept').text().split('·')[0];

      } else if (message.url.includes('glassdoor.com')) {

        url = $('article.jobDetails').attr('data-id');
        jobTitle = $('h1.jobTitle').text();
        jobLocation = $('.compInfo').children('span').eq(1).text().replace(/[–]/, '');
        company = $('.employerName').text();

      } else if (message.url.includes('stackoverflow.com')) {

        jobTitle = $("a.fc-black-900").text();
        company = $("a.fc-black-700").text();
        jobLocation = $("span.fc-black-500").first().text().replace(/[\n|]/g, '');

      } else if (message.url.includes('indeed.com')) {

        jobTitle = $('#vjs-jobtitle').text();
        company = $('#vjs-cn').text() || $('#vjs-cn').children().text() ;
        jobLocation = $('#vjs-loc').text().replace(/-/, '');

      } else if (message.url.includes('monster.com')) {

        jobTitle = $('h1.title').text().split('at')[0];
        company = $('h1.title').text().split('at')[1];
        jobLocation = $('h2.subtitle').text();

      } else if (message.url.includes('ziprecruiter.com')) {

        jobTitle = $('h1.job_title').text();
        company = $('.job_location_name').text();
        jobLocation = $('.job_location_city').text();

      } else if (message.url.includes('wayup.com')) {

        jobTitle = $('.ListingApplication__HeaderPositionTitle-jHqaqC').text();
        company = $('.ListingApplication__HeaderCompanyName-lkfLno').text();
        jobLocation = $('.ListingApplication__HeaderListingLocation-frbGKz').text();

      } else {
        jobTitle = '';
        company = '';
        jobLocation = '';
      }

      response.jobTitle = jobTitle.trim();
      response.company = company.trim();
      response.jobLocation = jobLocation.trim();
      response.url = url;

      callback(response);
    }
  }
)