(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "ziprecruiter.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $ } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			const $jobDetailsScroller = $('[data-testid="job-details-scroll-container"]').first();
			if ($jobDetailsScroller.length) {
				const $styledTitle = $jobDetailsScroller.find('h2[class*="text-header-md"]').first();
				const $titleHeading = $styledTitle.length ? $styledTitle : $jobDetailsScroller.find("h2").first();
				if ($titleHeading.length && !/^job description$/i.test(utils.cleanText($titleHeading.text()))) {
					result.jobTitle = utils.cleanText($titleHeading.text());
					const $companyLinkNextToTitle = $titleHeading.next("a");
					if ($companyLinkNextToTitle.length) {
						result.company =
							utils.cleanText($companyLinkNextToTitle.text()) ||
							utils.cleanText($companyLinkNextToTitle.attr("aria-label"));
					}
					if (!result.company) {
						const $companyProfileLink = $jobDetailsScroller.find('a[href*="/co/"]').first();
						result.company =
							utils.cleanText($companyProfileLink.text()) ||
							utils.cleanText($companyProfileLink.attr("aria-label"));
					}
					const $locationParagraph = $titleHeading.next("a").length
						? $titleHeading.next("a").next("div").find("p").first()
						: $jobDetailsScroller.find("div.mb-24 p, .mb-24 p").first();
					if ($locationParagraph.length) {
						let locationLine = utils.cleanText($locationParagraph.text());
						if (locationLine.includes("•")) locationLine = utils.cleanText(locationLine.split("•")[0]);
						result.jobLocation = locationLine;
					}
				}
			}
			if (!result.jobTitle) {
				result.jobTitle =
					utils.cleanText($("h1.job_title").text()) ||
					utils.cleanText($('[data-testid="job-title"]').first().text()) ||
					utils.cleanText($("h1").first().text());
			}
			if (!result.company) {
				result.company =
					utils.cleanText($("a.job_details_link").text()) ||
					utils.cleanText($('[data-testid="company-name"]').first().text());
			}
			if (!result.jobLocation) {
				result.jobLocation =
					utils.cleanText($("a.location_text span span").text()) ||
					utils.cleanText($('[data-testid="job-location"]').first().text());
			}

			return result;
		},
	});
})();
