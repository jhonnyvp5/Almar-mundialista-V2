import appHandler from '../server';

export const config = {
  api: {
    bodyParser: false,
  },
};

export default async function handler(req: any, res: any) {
  // Pass the request to the imported handler from server.ts
  return appHandler(req, res);
}
