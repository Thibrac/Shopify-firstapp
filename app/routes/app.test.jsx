// /app/routes/app.test.jsx

import { Page, Layout, Card, Button, Text } from "@shopify/polaris";
import { authenticate } from "../shopify.server";
import { json } from "@remix-run/node";
import { useNavigate } from "@remix-run/react";


// On a besoin d'un loader simple pour que la page s'authentifie
export const loader = async ({ request }) => {
	await authenticate.admin(request);
	return json({});
};

export default function TestPage() {
	const navigate = useNavigate();

	const handleSimpleClick = () => {
		// Test 1: Est-ce que la console réagit ?
		console.log("Le bouton de test a été cliqué !");
	};

	const handleNavigateClick = () => {
		// Test 2: Est-ce que la navigation fonctionne ?
		console.log("Tentative de navigation vers la page d'accueil...");
		navigate('/app');
	};

	return (
		<Page>
			<Layout>
				<Layout.Section>
					<Card>
						<Text variant="headingMd" as="h2">Page de Test</Text>
						<p>Cette page sert à isoler les problèmes.</p>
						<Button onClick={handleSimpleClick} variant="primary">
							Test Console.log
						</Button>
						<Button onClick={handleNavigateClick}>
							Test Navigation
						</Button>
					</Card>
				</Layout.Section>
			</Layout>
		</Page>
	);
}