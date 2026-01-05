import SavedTrialsClient from './SavedTrialsClient';

export const metadata = {
    title: 'Saved Trials | PatientMatch',
    description: 'Review your saved clinical trials.',
};

export default function SavedTrialsPage() {
    return (
        <main className="min-h-screen pb-24 pt-16">
            <div className="pm-container">
                <SavedTrialsClient />
            </div>
        </main>
    );
}
