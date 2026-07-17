const supportedDocumentTypes = [
  "contact",
  "content_block_pension",
  "content_block_contact",
  "content_block_tax",
  "content_block_time_period",
];

// The regex used to find UUIDs
const uuidRegex =
  /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/;
// The regex used to find content ID aliases
const contentIdAliasRegex = /[a-z0-9\-–—]+/;
// The regex to find the optional internal content path after the UUID, begins with '/'
const internalContentPathRegex = /(\/[a-z0-9_\-–—/]*)?/;
// The regex used to find the optional format specifier begins with '#'
const formatSpecifierRegex = /(#[^}#]+)?/;
// The regex used when scanning a document using ContentBlockTools::ContentBlockReference.find_all_in_document
const pattern = [
  "(",
  "\\{\\{embed:", // Start of the embed tag
  `(${supportedDocumentTypes.join("|")})`, // The supported document types
  ":", // Separator between the embed type and the UUID
  `(${uuidRegex.source}|${contentIdAliasRegex.source})`, // The UUID or content ID alias
  internalContentPathRegex.source, // The optional internal content path
  formatSpecifierRegex.source, // The optional format specifier
  "\\}\\}", // End of the embed tag
  ")",
].join("");

const embedRegex = new RegExp(pattern, "g");

const embedCodeRegex = new RegExp(`^${pattern}$`);

export const isValidEmbedCode = (embedCode: string): boolean =>
  embedCodeRegex.test(embedCode);

export default embedRegex;
