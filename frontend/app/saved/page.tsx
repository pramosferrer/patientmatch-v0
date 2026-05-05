import SavedTrialsClient from './SavedTrialsClient';

export const metadata = {
    title: 'Saved on this device | PatientMatch',
    description: 'Review clinical trials saved in this browser.',
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
