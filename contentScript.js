chrome.runtime.onMessage.addListener(

  function(message, sender, callback) {
    if (message.action === 'parse') {
      const response = {};
      let jobTitle, company, jobLocation, url;
      url = message.url;

      if (message.url.includes('linkedin.com')) {

        jobTitle = $("h1.jobs-top-card__job-title").text();
        company = $("a.jobs-top-card__company-url")
          .text()
          .replace(/\n/g, '');
        jobLocation = $('span.jobs-top-card__bullet').first().text().replace(/\n/g, '');

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
        company = $("a.fc-black-800").text();
        jobLocation = $("span.fc-black-500").first().text().replace(/[\n|]/g, '');

      } else if (message.url.includes('indeed.com')) {

        jobTitle = $('#vjs-jobtitle').text();
        company = $('#vjs-cn').text() || $('#vjs-cn').children().text() ;
        jobLocation = $('#vjs-loc').text().replace(/-/, '');

      } else if (message.url.includes('monster.com')) {

        const header = $("h1.title").text();
        if (header.includes(' at ')) {
          jobTitle = header.split('at')[0];
          company = header.split('at')[1];
        } else if (header.includes(' from ')) {
          jobTitle = header.split('from')[0];
          company = header.split('from')[1];
        }
        jobLocation = $('h2.subtitle').text();

      } else if (message.url.includes('ziprecruiter.com')) {

        jobTitle = $('h1.job_title').text();
        company = $('a.job_details_link').text();
        jobLocation = $("a.location_text span span").text();

      } else if (message.url.includes('wayup.com')) {

        jobTitle = $('.ListingApplication__HeaderPositionTitle-jHqaqC').text();
        company = $('.ListingApplication__HeaderCompanyName-lkfLno').text();
        jobLocation = $('.ListingApplication__HeaderListingLocation-frbGKz').text();

      } else if (message.url.includes('hire.withgoogle.com')) {

        jobTitle = $("h1.bb-jobs-posting__job-title").text();
        company = $("img.ptor-job-posting-company-logo").attr("alt");
        jobLocation = $("li.ptor-job-view-location").text();

      } else if (message.url.includes('jobvite.com')) {

        jobTitle = $("h2.jv-header").text();
        company = $(".jv-logo a img").attr("alt");
        jobLocation = $("p.jv-job-detail-meta")
          .text()
          .replace(/[\n]/g, "");

      } else if (message.url.includes('workable.com')) {

        jobTitle = $(".section--header h1").text();
        company = $("title").text().split('-')[0];
        jobLocation = $(".section--header h1")
          .next()
          .text();

      } else {
        jobTitle = '';
        company = '';
        jobLocation = '';
      }

      response.jobTitle = jobTitle ? jobTitle.trim() : '';
      response.company = company ? company.trim() : '';
      response.jobLocation = jobLocation ? jobLocation.trim() : '';
      response.url = url;

      callback(response);
    }
  }
)