(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "glassdoor.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $ } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			const $pageHeader = $('[data-test="job-details-header"]').first();
			const $detailsPane = $('[class*="JobDetails_jobDetailsContainer"]').first();
			const $titleLookupRoot = $pageHeader.length
				? $pageHeader
				: $detailsPane.length
					? $detailsPane
					: $(document);

			result.jobTitle =
				utils.cleanText($pageHeader.find("h1").first().text()) ||
				utils.cleanText($detailsPane.find('h1[id^="jd-job-title-"]').first().text()) ||
				utils.cleanText($titleLookupRoot.find('h1[id^="jd-job-title-"]').first().text()) ||
				utils.cleanText($titleLookupRoot.find('[data-test="job-title"]').first().text()) ||
				utils.cleanText($titleLookupRoot.find('h1[data-test="job-title"]').first().text()) ||
				utils.cleanText($titleLookupRoot.find('[class*="JobDetails_jobTitle"]').first().text()) ||
				utils.cleanText($titleLookupRoot.find("h1.jobTitle").first().text());

			result.company =
				utils.cleanText($pageHeader.find("h4").first().text()) ||
				utils.cleanText($titleLookupRoot.find('[data-test="employer-name"]').first().text()) ||
				utils.cleanText($titleLookupRoot.find(".employerName").first().text()) ||
				utils.cleanText($titleLookupRoot.find('[data-test="header-company-name"]').first().text());

			result.jobLocation =
				utils.cleanText($pageHeader.find('[data-test="location"]').first().text()) ||
				utils.cleanText($detailsPane.find('[data-test="location"]').first().text()) ||
				utils.cleanText($titleLookupRoot.find('[data-test="location"]').first().text()) ||
				utils.cleanText($titleLookupRoot.find(".location").first().text()) ||
				utils.cleanText($titleLookupRoot.find(".compInfo").children("span").eq(1).text().replace(/[–]/, ""));

			return result;
		},
	});
})();
