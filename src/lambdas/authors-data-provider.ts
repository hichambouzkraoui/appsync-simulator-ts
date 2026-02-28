import { Handler } from 'aws-lambda';
import { Author } from '../types/author';

const authors: Author[] = [
  {
    id: 1,
    name: "Jessica J. Cano"
  },
  {
    id: 2,
    name: "Peter L. Garcia"
  }
];

export const handler: Handler = async (event) => {
  console.log('[AuthorsDataProvider] Received event:', JSON.stringify(event, null, 2));
  
  const { info, source, arguments: args } = event;
  const fieldName = info?.fieldName;
  
  console.log('[AuthorsDataProvider] Field:', fieldName, 'Arguments:', args, 'Source:', source);

  let result;
  
  // Handle Query.authors
  if (fieldName === 'authors') {
    result = authors;
    console.log('[AuthorsDataProvider] Returning all authors:', result.length);
  }
  // Handle Book.author (get author by book's authorId)
  else if (fieldName === 'author' && source?.authorId) {
    result = authors.find(author => author.id === source.authorId) || null;
    console.log('[AuthorsDataProvider] Found author for book:', result);
  }
  // Handle getAuthorById
  else if (args?.id) {
    result = authors.find(author => author.id === args.id) || null;
    console.log('[AuthorsDataProvider] Found author:', result);
  }
  else {
    console.error('[AuthorsDataProvider] Unknown operation:', fieldName);
    throw new Error(`Unknown operation: ${fieldName}`);
  }
  
  console.log('[AuthorsDataProvider] Response:', JSON.stringify(result, null, 2));
  return result;
};
