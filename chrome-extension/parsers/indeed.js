(function () {
	const api = window.JobMateParsers;
	if (!api) return;

	api.register({
		domain: "indeed.com",
		parseHost: context => {
			const utils = window.JobMateUtils;
			const { $, pageUrl } = context;
			const result = { jobTitle: "", company: "", jobLocation: "", url: "" };

			const $jobComponent =
				$("#jobsearch-ViewjobPaneWrapper .jobsearch-JobComponent").first().length
					? $("#jobsearch-ViewjobPaneWrapper .jobsearch-JobComponent").first()
					: $(".fastviewjob .jobsearch-JobComponent").first().length
						? $(".fastviewjob .jobsearch-JobComponent").first()
						: $(".jobsearch-JobComponent").first();
			const $jobDetailRoot = $jobComponent.length ? $jobComponent : $(document);

			let titleText = utils.cleanText(
				$jobDetailRoot.find('[data-testid="jobsearch-JobInfoHeader-title"]').text(),
			);
			titleText = titleText.replace(/\s*-\s*job post\s*$/i, "").trim();

			result.jobTitle =
				titleText ||
				utils.cleanText($jobDetailRoot.find("h1.jobsearch-JobInfoHeader-title").text()) ||
				utils.cleanText($jobDetailRoot.find("h2.jobsearch-JobInfoHeader-title").text()) ||
				utils.cleanText($jobDetailRoot.find("h2.jobTitle").text()) ||
				utils.cleanText($("#vjs-jobtitle").text());

			result.company =
				utils.cleanText($jobDetailRoot.find('[data-testid="inlineHeader-companyName"] a').first().text()) ||
				utils.cleanText($jobDetailRoot.find('[data-testid="inlineHeader-companyName"]').text()) ||
				utils.cleanText($jobDetailRoot.find('[data-testid="jobsearch-JobInfoHeader-companyName"]').text()) ||
				utils.cleanText($("#vjs-cn").text() || $("#vjs-cn").children().text());

			let locText =
				utils.cleanText(
					$jobDetailRoot
						.find('[data-testid="inlineHeader-companyLocation"] [data-testid="job-location"]')
						.text(),
				) ||
				utils.cleanText($jobDetailRoot.find('[data-testid="inlineHeader-companyLocation"]').text()) ||
				utils.cleanText($jobDetailRoot.find('[data-testid="jobsearch-JobInfoHeader-companyLocation"]').text()) ||
				utils.cleanText($jobDetailRoot.find('[data-testid="job-location"]').first().text()) ||
				utils.cleanText($("#vjs-loc").text());
			result.jobLocation = locText.replace(/\s*•\s*/g, " ").trim();

			const indeedParseJkFromHref = href => {
				if (!href) return "";
				try {
					const resolved = new URL(href, pageUrl.startsWith("http") ? pageUrl : "https://www.indeed.com");
					return (
						resolved.searchParams.get("jk") ||
						resolved.searchParams.get("vjk") ||
						resolved.searchParams.get("fromjk") ||
						""
					);
				} catch (_) {
					return "";
				}
			};

			let indeedJk = "";
			try {
				const tabUrl = new URL(pageUrl);
				indeedJk = tabUrl.searchParams.get("jk") || tabUrl.searchParams.get("vjk") || "";
			} catch (_) {}

			if (!indeedJk) {
				indeedJk = indeedParseJkFromHref(
					$jobDetailRoot.find('button[href*="applystart"], a[href*="applystart"]').first().attr("href"),
				);
			}
			if (!indeedJk) indeedJk = indeedParseJkFromHref($jobDetailRoot.find('a[href*="viewjob"]').first().attr("href"));
			if (!indeedJk)
				indeedJk = indeedParseJkFromHref($jobDetailRoot.find('a[href*="fromjk="]').first().attr("href"));
			if (!indeedJk) {
				indeedJk =
					$jobDetailRoot.attr("data-jk") ||
					$jobDetailRoot.closest("[data-jk]").attr("data-jk") ||
					$jobDetailRoot.find("[data-jk]").first().attr("data-jk") ||
					"";
			}
			if (!indeedJk) indeedJk = indeedParseJkFromHref($('meta[property="og:url"]').attr("content"));
			if (!indeedJk) indeedJk = indeedParseJkFromHref($('link[rel="canonical"]').attr("href"));

			if (indeedJk) {
				try {
					result.url = `https://${new URL(pageUrl).host}/viewjob?jk=${encodeURIComponent(indeedJk)}`;
				} catch (_) {
					result.url = `https://www.indeed.com/viewjob?jk=${encodeURIComponent(indeedJk)}`;
				}
			}

			return result;
		},
	});
})();
