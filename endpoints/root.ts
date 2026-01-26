import type { Request, Response } from 'express';

export default async function index(req: Request, res: Response) {
    res.redirect('https://github.com/hackclub/firehose');
}
