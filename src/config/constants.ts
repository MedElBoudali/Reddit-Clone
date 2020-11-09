export const __prod__ = process.env.NODE_ENV === 'production';
export const __port__ = 4000;
export const __listenMessage__ = (port: number) =>
  `⚡️[server] => Server is running: \n - Home: http://localhost:${port} \n - Graphql: http://localhost:${port}/graphql`;
export const cookieName = 'qid';
