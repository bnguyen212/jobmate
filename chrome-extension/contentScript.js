/**
 * Parses job title, company, location, and URL from the active tab DOM when
 * the popup sends { action: 'parse', url }.
 */
chrome.runtime.onMessage.addListener(function (message, _sender, callback) {
	if (message.action !== "parse") return;

	const utils = window.JobMateUtils;
	const pageUrl = message.url;
	const liveUrl = location.href || "";
	const effectivePageUrl = liveUrl || pageUrl || "";
	const emptyParseResult = () => ({
		jobTitle: "",
		company: "",
		jobLocation: "",
		url: effectivePageUrl || "",
	});
	if (!utils) {
		callback(emptyParseResult());
		return;
	}

	const DEBUG_EMBEDDED_DETECTION = true;
	const supportedDomains = window.JobMateParsers?.getSupportedDomains?.() ?? [];

	const runRegisteredParser = ({ domain, embedded = false, evidenceUrl = "" }) => {
		if (!window.JobMateParsers || !window.JobMateParsers.findByDomain) return null;
		const siteParser = window.JobMateParsers.findByDomain(domain);
		if (!siteParser) return null;

		const context = { $, pageUrl: effectivePageUrl };

		if (embedded && siteParser.parseEmbedded) return siteParser.parseEmbedded(context, evidenceUrl);
		if (!embedded && siteParser.parseHost) return siteParser.parseHost(context);
		return null;
	};

	const debugEmbeddedDetection = (embeddedDetection, evidenceUrl) => {
		if (!DEBUG_EMBEDDED_DETECTION) return;
		console.log("[JobMate] Embedded ATS detection", {
			pageUrl: utils.cleanText(pageUrl),
			platform: embeddedDetection?.platform || "",
			evidenceUrl: evidenceUrl || "",
			evidenceCount: (embeddedDetection?.evidenceUrls || []).length,
		});
	};

	const parseJobFromDom = async () => {
		let jobTitle = "";
		let company = "";
		let jobLocation = "";
		let jobUrl = effectivePageUrl;

		const mergeParserResult = parserOutput => {
			if (!parserOutput) return;
			jobTitle = utils.firstNonEmpty(jobTitle, parserOutput.jobTitle);
			company = utils.firstNonEmpty(company, parserOutput.company);
			jobLocation = utils.firstNonEmpty(jobLocation, parserOutput.jobLocation);
			jobUrl = utils.firstNonEmpty(parserOutput.url, jobUrl);
		};

		let matchedDomain = null;
		for (const domain of supportedDomains) {
			if (effectivePageUrl.includes(domain)) {
				matchedDomain = domain;
				break;
			}
		}

		if (matchedDomain) {
			const result = runRegisteredParser({ domain: matchedDomain });
			mergeParserResult(await Promise.resolve(result));
		} else {
			const embeddedDetection = utils.detectEmbeddedPlatform($, effectivePageUrl, utils.cleanText);
			const evidenceUrlList = embeddedDetection.evidenceUrls || [];
			const evidenceUrlPattern =
				utils.embeddedEvidenceUrlPatternByPlatform[embeddedDetection.platform];
			let chosenEvidenceUrl = "";
			if (evidenceUrlPattern) {
				chosenEvidenceUrl = utils.firstMatchingEvidenceUrl(evidenceUrlList, evidenceUrlPattern);
				const embeddedResult = runRegisteredParser({
					domain: embeddedDetection.platform,
					embedded: true,
					evidenceUrl: chosenEvidenceUrl,
				});
				mergeParserResult(await Promise.resolve(embeddedResult));
			}
			debugEmbeddedDetection(embeddedDetection, chosenEvidenceUrl);
		}
		return { jobTitle, company, jobLocation, url: jobUrl };
	};

	parseJobFromDom()
		.then(result => {
			callback(result || emptyParseResult());
		})
		.catch(() => {
			callback(emptyParseResult());
		});
	return true;
});
