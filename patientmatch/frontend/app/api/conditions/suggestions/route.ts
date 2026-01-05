import { NextResponse } from 'next/server';
import { getConditionCatalog } from '@/shared/conditions.catalog';

export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const query = searchParams.get('query') || '';
        
        const catalog = await getConditionCatalog();
        
        // If no query, return all conditions with trials (count > 0)
        if (!query || query.length < 2) {
            const withTrials = catalog.all
                .filter(c => c.count > 0)
                .slice(0, 50)
                .map(c => ({
                    slug: c.slug,
                    label: c.label
                }));
            return NextResponse.json(withTrials);
        }
        
        // Search in labels and synonyms
        const normalizedQuery = query.toLowerCase().trim();
        const matches = catalog.all.filter(c => 
            c.label.toLowerCase().includes(normalizedQuery) || 
            c.synonyms?.some(s => s.toLowerCase().includes(normalizedQuery))
        );
        
        const results = matches.slice(0, 20).map(c => ({
            slug: c.slug,
            label: c.label
        }));
        
        return NextResponse.json(results);
    } catch (error) {
        console.error('Error fetching conditions:', error);
        return NextResponse.json(
            { error: 'Failed to fetch conditions' },
            { status: 500 }
        );
    }
}
