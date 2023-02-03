import { buildSchema, getIntrospectionQuery, parse, print, Source } from 'graphql';
import { coverage } from '../../src/index';

describe('coverage', () => {
  const schema = buildSchema(/* GraphQL */ `
    interface Identifiable {
      id: ID
      createdAt: Int
    }

    type Post implements Identifiable {
      id: ID
      createdAt: Int
      title: String
      author: String
    }

    type Query {
      post: Post
      posts: [Post!]
      objectById(id: ID!, unused: String): Identifiable
    }

    type Mutation {
      submitPost(title: String!, author: String!): Post!
    }

    schema {
      query: Query
      mutation: Mutation
    }
  `);

  test('basic', () => {
    const doc = parse(/* GraphQL */ `
      query getPost {
        post {
          id
          __typename
          title
        }
      }

      query getObjectById {
        objectById(id: 2) {
          id
          ... on Post {
            title
            createdAt
          }
        }
      }

      mutation submitPost {
        submitPost(title: "Random", author: "More random") {
          id
        }
      }
    `);

    const results = coverage(schema, [new Source(print(doc))]);

    // Query
    expect(results.types.Query.hits).toEqual(2);
    expect(results.types.Query.children.posts.hits).toEqual(0);
    expect(results.types.Query.children.post.hits).toEqual(1);
    expect(results.types.Query.children.objectById.hits).toEqual(1);
    expect(results.types.Query.children.objectById.children.id.hits).toEqual(1);
    expect(results.types.Query.children.objectById.children.unused.hits).toEqual(0);
    // Post
    expect(results.types.Post.hits).toEqual(5);
    expect(results.types.Post.children.id.hits).toEqual(2);
    expect(results.types.Post.children.title.hits).toEqual(2);
    expect(results.types.Post.children.author.hits).toEqual(0);
    expect(results.types.Post.children.createdAt.hits).toEqual(1);
    // Identifiable
    expect(results.types.Identifiable.hits).toEqual(1);
    expect(results.types.Identifiable.children.id.hits).toEqual(1);
    expect(results.types.Identifiable.children.createdAt.hits).toEqual(0);
    // Mutation
    expect(results.types.Mutation.hits).toEqual(1);
    expect(results.types.Mutation.children.submitPost.hits).toEqual(1);
    expect(results.types.Mutation.children.submitPost.children.title.hits).toEqual(1);
    expect(results.types.Mutation.children.submitPost.children.author.hits).toEqual(1);

    // stats
    expect(results.stats.numTypes).toEqual(4);
    expect(results.stats.numTypesCovered).toEqual(4);
    expect(results.stats.numTypesCoveredFully).toEqual(1);
    expect(results.stats.numFields).toEqual(14);
    expect(results.stats.numFiledsCovered).toEqual(10);
  });

  test('no coverage', () => {
    const results = coverage(schema, []);

    // Query
    expect(results.types.Query.hits).toEqual(0);
    expect(results.types.Query.children.posts.hits).toEqual(0);
    expect(results.types.Query.children.post.hits).toEqual(0);
    expect(results.types.Query.children.objectById.hits).toEqual(0);
    expect(results.types.Query.children.objectById.children.id.hits).toEqual(0);
    expect(results.types.Query.children.objectById.children.unused.hits).toEqual(0);
    // Post
    expect(results.types.Post.hits).toEqual(0);
    expect(results.types.Post.children.id.hits).toEqual(0);
    expect(results.types.Post.children.title.hits).toEqual(0);
    expect(results.types.Post.children.author.hits).toEqual(0);
    expect(results.types.Post.children.createdAt.hits).toEqual(0);
    // Identifiable
    expect(results.types.Identifiable.hits).toEqual(0);
    expect(results.types.Identifiable.children.id.hits).toEqual(0);
    expect(results.types.Identifiable.children.createdAt.hits).toEqual(0);
    // Mutation
    expect(results.types.Mutation.hits).toEqual(0);
    expect(results.types.Mutation.children.submitPost.hits).toEqual(0);
    expect(results.types.Mutation.children.submitPost.children.title.hits).toEqual(0);
    expect(results.types.Mutation.children.submitPost.children.author.hits).toEqual(0);

    // stats
    expect(results.stats.numTypes).toEqual(4);
    expect(results.stats.numTypesCovered).toEqual(0);
    expect(results.stats.numTypesCoveredFully).toEqual(0);
    expect(results.stats.numFields).toEqual(14);
    expect(results.stats.numFiledsCovered).toEqual(0);
  });

  test('introspection', () => {
    const introspectionQuery = getIntrospectionQuery();
    expect(() => coverage(schema, [new Source(introspectionQuery)])).not.toThrowError();
  });
});
