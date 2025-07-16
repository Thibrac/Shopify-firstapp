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
	Listbox,
} from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import { useFetcher } from "@remix-run/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
	await authenticate.admin(request);
	return json({});
};

export const action = async ({ request }) => {
	const { admin } = await authenticate.admin(request);
	const formData = await request.formData();
	const intent = formData.get("intent");

	if (intent === "search_products") {
		// TA LOGIQUE DE RECHERCHE - ON N'Y TOUCHE PAS
		const searchTerm = formData.get("searchTerm");
		if (!searchTerm) {
			return json({ products: [] });
		}
		const productsResponse = await admin.graphql(
			`#graphql
		query searchProducts($query: String!) {
		  products(first: 10, query: $query) {
			edges {
			  node {
				id, title, handle, status,
				featuredImage { url },
				variants(first: 1) { edges { node { price } } }
			  }
			}
		  }
		}`, {
			variables: {
				query: `title:${searchTerm}* OR tag:${searchTerm}* OR product_type:${searchTerm}*`
			}
		}
		);
		const productsJson = await productsResponse.json();
		const products = productsJson.data.products.edges.map(edge => edge.node);
		return json({ products });
	}

	// --- CORRECTION DE LA LOGIQUE DE CRÉATION ---
	if (intent === "create_raffle") {
		console.log("\n\n--- DÉBUT DE LA CRÉATION DE LA TOMBOLA ---");
		const raffleData = Object.fromEntries(formData);
		console.log("1. Données brutes reçues:", raffleData);

		// On prépare les données pour l'API
		const metaobjectPayload = {
			type: "raffle_product",
			fields: [
				{ key: "product_id", value: raffleData.productId },
				{ key: "product_handle", value: raffleData.productHandle },
				{ key: "title", value: raffleData.productTitle },
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

			// Si Shopify nous renvoie des erreurs de validation, on les affiche
			if (responseJson.data?.metaobjectCreate?.userErrors?.length > 0) {
				console.error("### ERREUR DE VALIDATION SHOPIFY ###");
				return json({ errors: responseJson.data.metaobjectCreate.userErrors }, { status: 400 });
			}

			// Si une autre erreur GraphQL survient
			if (responseJson.errors) {
				console.error("### ERREUR GÉNÉRALE GRAPHQL ###");
				return json({ errors: responseJson.errors }, { status: 500 });
			}

			console.log("4. Succès ! Redirection...");
			return redirect("/app/raffles");

		} catch (error) {
			console.error("5. ERREUR FATALE (CATCH) ###", error);
			return json({ errors: [{ message: "L'appel a échoué." }] }, { status: 500 });
		}
	}

	return json({ message: "Intent invalide." }, { status: 400 });
};

export default function CreateRafflePage() {
	const formFetcher = useFetcher();
	const searchFetcher = useFetcher();
	const actionData = formFetcher.data;

	const [searchTerm, setSearchTerm] = useState("");
	const [selectedProduct, setSelectedProduct] = useState(null);
	const [quantity, setQuantity] = useState("1");
	const [time, setTime] = useState("23:59");
	const [isActive, setIsActive] = useState(true);

	const formErrors = actionData?.errors || {};
	const searchResults = searchFetcher.data?.products || [];

	const [{ month, year }, setDate] = useState({
		month: new Date().getMonth(),
		year: new Date().getFullYear(),
	});
	const [selectedDate, setSelectedDate] = useState(new Date());

	const handleMonthChange = useCallback(
		(month, year) => setDate({ month, year }),
		[],
	);

	const handleDateChange = useCallback(({ start }) => {
		setSelectedDate(start);
		setDate({ month: start.getMonth(), year: start.getFullYear() });
	}, []);

	const handleSearch = useCallback((value) => {
		setSearchTerm(value);
		if (value.length > 2) {
			searchFetcher.submit({ searchTerm: value, intent: "search_products" }, { method: "post" });
		} else {
			searchFetcher.data = undefined;
		}
	}, [searchFetcher]);

	const handleSubmit = useCallback(() => {
		if (!selectedProduct) {
			alert("Please select a product for the raffle.");
			return;
		}

		const deadlineWithTime = new Date(selectedDate);
		const [hours, minutes] = time.split(':');
		deadlineWithTime.setHours(parseInt(hours, 10), parseInt(minutes, 10), 0, 0);

		const formData = new FormData();
		formData.append("productId", selectedProduct.id);
		formData.append("productHandle", selectedProduct.handle);
		formData.append("productTitle", selectedProduct.title);
		formData.append("quantityAvailable", quantity);
		formData.append("deadline", deadlineWithTime.toISOString());
		formData.append("isActive", isActive.toString());
		formData.append("intent", "create_raffle");

		formFetcher.submit(formData, { method: "post" });
	}, [selectedProduct, quantity, selectedDate, time, isActive, formFetcher]);

	useEffect(() => {
		if (formFetcher.state === "idle" && formFetcher.data && !formFetcher.data.errors) { }
	}, [formFetcher.state, formFetcher.data]);

	return (
		<Page>
			<TitleBar title="Create a new raffle" />
			<Layout>
				<Layout.Section>
					<Card>
						<BlockStack gap="300">
							<Text as="h2" variant="headingMd">1. Select a Shopify product</Text>
							<TextField
								label="Search for a product"
								value={searchTerm}
								onChange={handleSearch}
								autoComplete="off"
								clearButton
								onClearButtonClick={() => {
									setSearchTerm("");
									setSelectedProduct(null);
									searchFetcher.data = undefined;
								}}
							/>
							{searchFetcher.state === "loading" ? (
								<Text>Chargement des produits...</Text>
							) : searchResults.length > 0 ? (
								<Listbox>
									{searchResults.map((product) => (
										<List.Item key={product.id}>
											<Button
												onClick={() => {
													setSelectedProduct(product);
													setSearchTerm(product.title);
													searchFetcher.data = undefined;
												}}
												plain
											>
												<InlineStack gap="200" align="center">
													{product.featuredImage && (
														<Thumbnail
															source={product.featuredImage.url}
															alt={product.title}
															size="small"
														/>
													)}
													<BlockStack gap="100">
														<Text as="p" variant="bodyMd" fontWeight="bold">
															{product.title}
														</Text>
														<Text as="span" variant="bodySm" color="subdued">
															{product.variants.edges[0]?.node?.price ? `Prix: ${product.variants.edges[0].node.price.amount} ${product.variants.edges[0].node.price.currencyCode}` : "Pas de prix"}
														</Text>
													</BlockStack>
												</InlineStack>
											</Button>
										</List.Item>
									))}
								</Listbox>
							) : searchTerm.length > 2 && searchFetcher.state === "idle" ? (
								<Text>No product found for "{searchTerm}".</Text>
							) : (
								<Text>Type at least 3 characters to search for a product.</Text>
							)}
							{selectedProduct && (
								<BlockStack gap="100">
									<Text as="p" variant="bodyMd" fontWeight="bold">Selected product: {selectedProduct.title}</Text>
									<Text as="p" variant="bodySm">ID: {selectedProduct.id}</Text>
								</BlockStack>
							)}
						</BlockStack>
					</Card>
					<Card>
						<BlockStack gap="300">
							<Text as="h2" variant="headingMd">2. Configure the raffle details</Text>
							<TextField label="Quantity of snowboards (number of winners)" type="number" value={quantity} onChange={setQuantity} min={1} autoComplete="off" />
							<Text as="h3" variant="headingSm">Registration deadline</Text>
							<DatePicker
								month={month}
								year={year}
								onChange={handleDateChange}
								onMonthChange={handleMonthChange}
								selected={selectedDate}
							/>
							<TextField label="Deadline time (HH:MM)" type="time" value={time} onChange={setTime} autoComplete="off" />
							<ChoiceList
								title="Raffle status"
								choices={[{ label: "Active", value: "true" }, { label: "Inactive", value: "false" }]}
								selected={[`${isActive}`]}
								onChange={(value) => setIsActive(value[0] === "true")}
							/>
						</BlockStack>
					</Card>
					<Button primary onClick={handleSubmit} loading={formFetcher.state === "submitting"}>Create the raffle</Button>
				</Layout.Section>
			</Layout>
		</Page>
	);
}