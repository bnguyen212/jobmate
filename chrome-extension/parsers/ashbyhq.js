(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "ashbyhq.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $ } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			result.jobTitle =
				utils.cleanText($("h1.ashby-job-posting-heading").text()) ||
				utils.cleanText($('meta[property="og:title"]').attr("content"));
			result.company = utils.cleanText($(".ashby-job-posting-header img[alt]").first().attr("alt"));
			if (!result.company) {
				const rawDocumentTitle = document.title;
				const atSeparatorIndex = rawDocumentTitle.lastIndexOf(" @ ");
				if (atSeparatorIndex !== -1)
					result.company = utils.cleanText(rawDocumentTitle.slice(atSeparatorIndex + 3));
			}

			$(".ashby-job-posting-left-pane h2").each(function () {
				if (utils.cleanText($(this).text()).toLowerCase() === "location") {
					result.jobLocation = utils.cleanText($(this).next("p").text());
					return false;
				}
			});

			return result;
		},
	});
})();
