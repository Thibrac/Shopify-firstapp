import {
	Page,
	Layout,
	Card,
	Button,
	BlockStack,
	TextField,
	DatePicker,
	ChoiceList,
	List,
	Thumbnail,
	InlineStack,
	Text,
} from "@shopify/polaris";
import { useState, useCallback } from "react";
import { json, redirect } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";

// --- ACTION SUR LE SERVEUR ---
export const action = async ({ request }) => {
	const { admin } = await authenticate.admin(request);
	const formData = await request.formData();
	const intent = formData.get("intent");

	// INTENT 1: RECHERCHE DE PRODUITS
	if (intent === "search_products") {
		const searchTerm = formData.get("searchTerm");
		if (!searchTerm) {
			return json({ products: [] });
		}

		// CORRECTION : On demande price { amount, currencyCode }
		const productsResponse = await admin.graphql(
			`#graphql
			query searchProducts($query: String!) {
				products(first: 10, query: $query) {
					edges {
						node {
							id
							title
							handle
							featuredImage { url }
							variants(first: 1) {
								edges {
									node {
										price
									}
								}
							}
						}
					}
				}
			}
			`,
			{ variables: { query: `title:${searchTerm}*` } }
		);
		const productsJson = await productsResponse.json();
		const products = productsJson.data.products.edges.map(edge => edge.node);
		return json({ products });
	}

	// INTENT 2: CRÉATION DE LA TOMBOLA
	if (intent === "create_raffle") {
		console.log("\n\n--- DÉBUT DE LA CRÉATION DE LA TOMBOLA ---");
		const raffleData = Object.fromEntries(formData);
		console.log("1. Données brutes reçues:", raffleData);

		const metaobjectPayload = {
			type: "raffle_product",
			fields: [
				{ key: "product_id", value: raffleData.productId },
				{ key: "product_handle", value: raffleData.productHandle },
				{ key: "product_title", value: raffleData.productTitle },
				{ key: "quantity_available", value: raffleData.quantityAvailable },
				{ key: "deadline", value: raffleData.deadline },
				{ key: "is_active", value: raffleData.isActive },
			],
		};
		console.log("2. Payload envoyé à Shopify:", JSON.stringify(metaobjectPayload, null, 2));

		try {
			const response = await admin.graphql(
				`#graphql
				mutation createRaffleProduct($metaobject: MetaobjectCreateInput!) {
					metaobjectCreate(metaobject: $metaobject) {
						metaobject { id }
						userErrors { field, message }
					}
				}`,
				{ variables: { metaobject: metaobjectPayload } }
			);

			const responseJson = await response.json();
			console.log("3. Réponse COMPLÈTE de Shopify:", JSON.stringify(responseJson, null, 2));

			if (responseJson.data?.metaobjectCreate?.userErrors?.length > 0) {
				return json({ errors: responseJson.data.metaobjectCreate.userErrors }, { status: 400 });
			}
			if (responseJson.errors) {
				return json({ errors: responseJson.errors }, { status: 500 });
			}

			return redirect("/app/raffles");
		} catch (error) {
			console.error("5. ERREUR FATALE (CATCH):", error);
			return json({ errors: [{ message: "L'appel a échoué." }] }, { status: 500 });
		}
	}

	return json({ message: "Intent invalide" }, { status: 400 });
};

// --- COMPOSANT FRONTEND ---
export default function CreateRafflePage() {
	const formFetcher = useFetcher();
	const searchFetcher = useFetcher();
	const actionErrors = formFetcher.data?.errors;

	const [searchTerm, setSearchTerm] = useState("");
	const [selectedProduct, setSelectedProduct] = useState(null);
	const [quantity, setQuantity] = useState("1");
	const [isActive, setIsActive] = useState(true);

	// --- CORRECTION DE LA DATE ---
	const [selectedDate, setSelectedDate] = useState(new Date()); // On stocke un objet Date
	const [{ month, year }, setDate] = useState({ month: selectedDate.getMonth(), year: selectedDate.getFullYear() });
	const handleMonthChange = useCallback((month, year) => setDate({ month, year }), []);

	const searchResults = searchFetcher.data?.products || [];

	const handleSearch = useCallback((value) => {
		setSearchTerm(value);
		if (value.length > 2) {
			searchFetcher.submit({ searchTerm: value, intent: "search_products" }, { method: "post" });
		}
	}, [searchFetcher]);

	const handleSubmit = useCallback(() => {
		if (!selectedProduct) {
			alert("Veuillez sélectionner un produit.");
			return;
		}
		formFetcher.submit({
			intent: "create_raffle",
			productId: selectedProduct.id,
			productHandle: selectedProduct.handle,
			productTitle: selectedProduct.title,
			quantityAvailable: quantity,
			deadline: selectedDate.toISOString(), // On envoie le format ISO complet
			isActive: String(isActive),
		}, { method: "post" });
	}, [selectedProduct, quantity, selectedDate, isActive, formFetcher]);

	return (
		<Page title="Créer une tombola" backAction={{ content: "Tombolas", url: "/app/raffles" }}>
			<Layout>
				<Layout.Section>
					<BlockStack gap="500">
						<Card>
							<BlockStack gap="300">
								<Text as="h2" variant="headingMd">1. Sélectionner un produit</Text>
								<TextField label="Chercher un produit" value={searchTerm} onChange={handleSearch} autoComplete="off" />
								{searchResults.length > 0 && (
									<List>
										{searchResults.map((product) => (
											<List.Item key={product.id} onClick={() => {
												setSelectedProduct(product);
												setSearchTerm(product.title);
												searchFetcher.data = undefined;
											}}>
												<InlineStack blockAlign="center" gap="400">
													<Thumbnail source={product.featuredImage?.url || ''} alt={product.title} />
													<Text>{product.title}</Text>
												</InlineStack>
											</List.Item>
										))}
									</List>
								)}
								{selectedProduct && <Text variant="headingSm" as="h3">Sélectionné : {selectedProduct.title}</Text>}
							</BlockStack>
						</Card>

						<Card>
							<BlockStack gap="300">
								<Text as="h2" variant="headingMd">2. Configurer la tombola</Text>
								<TextField label="Quantité" type="number" value={quantity} onChange={setQuantity} min={1} autoComplete="off" />
								<Text as="h3" variant="headingSm">Date de fin</Text>
								<DatePicker month={month} year={year} onChange={setSelectedDate} onMonthChange={handleMonthChange} selected={selectedDate} />
								<ChoiceList title="Statut" choices={[{ label: "Actif", value: "true" }, { label: "Inactif", value: "false" }]} selected={[`${isActive}`]} onChange={(val) => setIsActive(val[0] === 'true')} />
							</BlockStack>
						</Card>

						<Button onClick={handleSubmit} variant="primary" loading={formFetcher.state === "submitting"}>Créer la tombola</Button>

						{actionErrors && (
							<Card>
								<BlockStack gap="200">
									<Text variant="headingMd" as="h3" color="critical">Erreurs</Text>
									{actionErrors.map((error, index) => (
										<Text key={index} color="critical">{error.message}</Text>
									))}
								</BlockStack>
							</Card>
						)}
					</BlockStack>
				</Layout.Section>
			</Layout>
		</Page>
	);
}