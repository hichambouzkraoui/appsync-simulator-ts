import { Handler } from 'aws-lambda';
import { Book } from '../types/book';

const books: Book[] = [
  {
    id: 1,
    title: "Assassin Of The Eclipse",
    authorId: 1
  },
  {
    id: 2,
    title: "Wolves Of The Great",
    authorId: 1
  },
  {
    id: 3,
    title: "Revenge With Wings",
    authorId: 2
  }
];

export const handler: Handler = async (event) => {
  console.log('[BooksDataProvider] Received event:', JSON.stringify(event, null, 2));
  
  const { info, source, arguments: args } = event;
  const fieldName = info?.fieldName;
  
  console.log('[BooksDataProvider] Field:', fieldName, 'Arguments:', args, 'Source:', source);

  let result;
  
  // Handle Query.books
  if (fieldName === 'books') {
    result = books;
    console.log('[BooksDataProvider] Returning all books:', result.length);
  }
  // Handle Author.books (get books by author)
  else if (fieldName === 'books' && source?.id) {
    result = books.filter(book => book.authorId === source.id);
    console.log('[BooksDataProvider] Found books for author:', result.length);
  }
  // Handle getBookById
  else if (args?.id) {
    result = books.find(book => book.id === args.id) || null;
    console.log('[BooksDataProvider] Found book:', result);
  }
  // Handle getBooksByAuthorId
  else if (args?.authorId) {
    result = books.filter(book => book.authorId === args.authorId);
    console.log('[BooksDataProvider] Found books for author:', result.length);
  }
  else {
    console.error('[BooksDataProvider] Unknown operation:', fieldName);
    throw new Error(`Unknown operation: ${fieldName}`);
  }
  
  console.log('[BooksDataProvider] Response:', JSON.stringify(result, null, 2));
  return result;
};
