(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "monster.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			const $jobViewWrapper = $('[data-testid="svx-job-view-wrapper"]').first();
			const $selectedListCard = $(".card-selected").first();

			if ($jobViewWrapper.length) {
				result.jobTitle = utils.cleanText($jobViewWrapper.find('[data-testid="jobTitle"]').first().text());
				result.company = utils.cleanText($jobViewWrapper.find('[data-testid="company"]').first().text());
				result.jobLocation = utils.cleanText(
					$jobViewWrapper.find('[data-testid="jobDetailLocation"]').first().text(),
				);
			}
			if (!result.jobTitle && $selectedListCard.length) {
				result.jobTitle = utils.cleanText($selectedListCard.find('[data-testid="jobTitle"]').first().text());
				result.company = utils.cleanText($selectedListCard.find('[data-testid="company"]').first().text());
				result.jobLocation = utils.cleanText(
					$selectedListCard.find('[data-testid="jobDetailLocation"]').first().text(),
				);
			}
			if (!result.jobTitle && /\/job-openings\//i.test(pageUrl)) {
				result.jobTitle = utils.cleanText($('[data-testid="jobTitle"]').first().text());
				result.company = utils.cleanText($('[data-testid="company"]').first().text());
				result.jobLocation = utils.cleanText($('[data-testid="jobDetailLocation"]').first().text());
			}
			if (!result.jobTitle) {
				const header = utils.cleanText($("h1.title").text());
				if (header.includes(" at ")) {
					result.jobTitle = utils.cleanText(header.split("at")[0]);
					result.company = utils.cleanText(header.split("at").slice(1).join("at"));
				} else if (header.includes(" from ")) {
					result.jobTitle = utils.cleanText(header.split("from")[0]);
					result.company = utils.cleanText(header.split("from").slice(1).join("from"));
				}
				result.jobLocation = utils.cleanText($("h2.subtitle").text());
			}

			const jobOpeningHref =
				$selectedListCard.find('a[data-testid="jobTitle"][href*="job-openings"]').first().attr("href") ||
				$jobViewWrapper.find('a[href*="job-openings"]').first().attr("href");
			if (jobOpeningHref) {
				try {
					result.url = new URL(
						jobOpeningHref,
						pageUrl.startsWith("http") ? pageUrl : "https://www.monster.com",
					).href;
				} catch (_) {
					result.url = jobOpeningHref;
				}
			}

			return result;
		},
	});
})();
