import { MyContext } from 'src/types';
import { MiddlewareFn } from 'type-graphql';

export const isAuth: MiddlewareFn<MyContext> = async ({ context }, next) => {
  const userId = context.req.session.userId;
  if (!userId) {
    return {
      error: {
        field: 'authenticated',
        message: 'Unauthorized'
      }
    };
  }
  return await next();
};
