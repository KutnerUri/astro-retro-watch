// Publishes the retrograde periods as /retrogrades.json (the Dataset's download link).
import data from '../../data/retrogrades.json';

export const GET = () => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });
