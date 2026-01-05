import { headers } from 'next/headers';
import { notFound } from 'next/navigation';
import { getServiceClient } from '@/lib/supabaseAdmin';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

const DEBUG_PAGE_SECRET = process.env.DEBUG_PAGE_SECRET;

export const dynamic = 'force-dynamic';

async function getTableCount(tableName: string): Promise<string> {
  try {
    // Check if service role key is available
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return 'Service role key not configured';
    }
    
    const supabase = getServiceClient();
    const { count, error } = await supabase
      .from(tableName)
      .select('*', { count: 'exact', head: true });
    
    if (error) {
      console.error(`Error counting ${tableName}:`, error);
      return `Error: ${error.message}`;
    }
    
    return count?.toString() || '0';
  } catch (error) {
    console.error(`Exception counting ${tableName}:`, error);
    return `Exception: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

async function listAllTables(): Promise<string[]> {
  // Since information_schema.tables is not accessible in Supabase,
  // return the known table names directly
  const knownTables = ['trials', 'patient_leads', 'events'];

  // Verify each table exists by trying to query it
  const verifiedTables: string[] = [];

  for (const tableName of knownTables) {
    try {
      const supabase = getServiceClient();
      const { error } = await supabase
        .from(tableName)
        .select('*', { count: 'exact', head: true })
        .limit(0);

      if (!error) {
        verifiedTables.push(tableName);
      }
    } catch (error) {
      console.error(`Table ${tableName} verification failed:`, error);
    }
  }

  return verifiedTables;
}

export default async function DebugPage() {
  if (process.env.NODE_ENV === 'production') {
    if (!DEBUG_PAGE_SECRET) {
      notFound();
    }
    const requestHeaders = await headers();
    const providedSecret = requestHeaders.get('x-debug-secret');
    if (providedSecret !== DEBUG_PAGE_SECRET) {
      notFound();
    }
  }

  const supabaseUrlPresent = !!process.env.SUPABASE_URL;
  const supabaseServiceKeyPresent = !!process.env.SUPABASE_SERVICE_ROLE_KEY;
  
  let trialsCount = 'Not available';
  let leadsCount = 'Not available';
  let eventsCount = 'Not available';
  let allTables: string[] = [];
  
  // Only try to get counts if we have the service key
  if (supabaseServiceKeyPresent) {
    allTables = await listAllTables();
    trialsCount = await getTableCount('trials');
    leadsCount = await getTableCount('patient_leads');
    eventsCount = await getTableCount('events');
  }

  return (
    <div className="container mx-auto p-6 max-w-2xl">
      <h1 className="text-3xl font-bold mb-6">Database Debug Info</h1>
      
      <div className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle>Environment Status</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <span className="font-medium">SUPABASE_URL:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  supabaseUrlPresent 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {supabaseUrlPresent ? 'Present' : 'Missing'}
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="font-medium">SUPABASE_SERVICE_ROLE_KEY:</span>
                <span className={`px-2 py-1 rounded text-sm ${
                  supabaseServiceKeyPresent 
                    ? 'bg-green-100 text-green-800' 
                    : 'bg-red-100 text-red-800'
                }`}>
                  {supabaseServiceKeyPresent ? 'Present' : 'Missing'}
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Table Counts</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="font-medium">trials:</span>
                <span className="text-lg font-mono">{trialsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">patient_leads:</span>
                <span className="text-lg font-mono">{leadsCount}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="font-medium">events:</span>
                <span className="text-lg font-mono">{eventsCount}</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Available Tables</CardTitle>
          </CardHeader>
          <CardContent>
            {allTables.length > 0 ? (
              <div className="space-y-2">
                {allTables.map((table) => (
                  <div key={table} className="flex justify-between items-center">
                    <span className="font-mono text-sm">{table}</span>
                    <span className="text-xs text-gray-500">✓</span>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-gray-500">No tables found or unable to list tables</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
