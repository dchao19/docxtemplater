const {getRight, getLeft, concatArrays} = require("./doc-utils");
const {XTTemplateError, throwRawTagNotInParagraph} = require("./errors");

function lastTagIsOpenTag(array, tag) {
	if (array.length === 0) {
		return false;
	}
	const lastTag = array[array.length - 1];
	const innerLastTag = lastTag.tag.substr(1);
	const innerCurrentTag = tag.substr(2, tag.length - 3);
	return innerLastTag.indexOf(innerCurrentTag) === 0;
}

function addTag(array, tag) {
	array.push({tag});
	return array;
}

function getListXmlElements(parts) {
	/*
	get the different closing and opening tags between two texts (doesn't take into account tags that are opened then closed (those that are closed then opened are returned)):
	returns:[{"tag":"</w:r>","offset":13},{"tag":"</w:p>","offset":265},{"tag":"</w:tc>","offset":271},{"tag":"<w:tc>","offset":828},{"tag":"<w:p>","offset":883},{"tag":"<w:r>","offset":1483}]
	*/
	const tags = parts.filter(function (part) {
		return part.type === "tag";
	}).map(function (part) {
		return part.value;
	});

	let result = [];

	for (let i = 0, tag; i < tags.length; i++) {
		tag = tags[i];
		// closing tag
		if (tag[1] === "/") {
			if (lastTagIsOpenTag(result, tag)) {
				result.pop();
			}
			else {
				result = addTag(result, tag);
			}
		}
		else if (tag[tag.length - 1] !== "/") {
			result = addTag(result, tag);
		}
	}
	return result;
}

function getExpandToDefault(parts) {
	const xmlElements = getListXmlElements(parts);
	for (let i = 0; i < xmlElements.length; i++) {
		const xmlElement = xmlElements[i];
		if(xmlElement.tag.indexOf("<w:tc") === 0) {
			return "w:tr";
		}
		if(xmlElement.tag.indexOf("<a:tc") === 0) {
			return "a:tr";
		}
	}
	return false;
}

function expandOne(part, postparsed, options) {
	const expandTo = part.expandTo || options.expandTo;
	const index = postparsed.indexOf(part);
	if (!expandTo) {
		return postparsed;
	}
	let right, left;
	try {
		right = getRight(postparsed, expandTo, index);
		left = getLeft(postparsed, expandTo, index);
	}
	catch (rootError) {
		if (rootError instanceof XTTemplateError) {
			throwRawTagNotInParagraph({part, rootError, postparsed, expandTo, index});
		}
		throw rootError;
	}
	const leftParts = postparsed.slice(left, index);
	const rightParts = postparsed.slice(index + 1, right + 1);
	let inner = options.getInner({index, part, leftParts, rightParts, left, right, postparsed});
	if (!inner.length) {
		inner.expanded = [leftParts, rightParts];
		inner = [inner];
	}
	return concatArrays([
		postparsed.slice(0, left),
		inner,
		postparsed.slice(right + 1),
	]);
}

function expandToOne(postparsed, options) {
	let errors = [];
	if (postparsed.errors) {
		errors = postparsed.errors;
		postparsed = postparsed.postparsed;
	}
	const expandToElements = postparsed.reduce(function (elements, part) {
		if (part.type === "placeholder" && part.module === options.moduleName) {
			elements.push(part);
		}
		return elements;
	}, []);

	expandToElements.forEach(function (part) {
		try {
			postparsed = expandOne(part, postparsed, options);
		}
		catch (error) {
			if (error instanceof XTTemplateError) {
				errors.push(error);
			}
			else {
				throw error;
			}
		}
	});
	return {postparsed, errors};
}

module.exports = {
	expandToOne,
	getExpandToDefault,
};
