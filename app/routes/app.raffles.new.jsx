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
import { TitleBar } from "@shopify/app-bridge-react";
import { useState, useCallback, useEffect } from "react";
import { json, redirect } from "@remix-run/node";
import { useLoaderData, useSubmit, useFetcher } from "@remix-run/react";
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
				id
				title
				handle
				status
				featuredImage {
				  url
				}
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
		}`
			, {
				variables: {
					query: `title:${searchTerm}* OR tag:${searchTerm}* OR product_type:${searchTerm}*` // Recherche flexible
				}
			}
		);
		const productsJson = await productsResponse.json();
		const products = productsJson.data.products.edges.map(edge => edge.node);
		return json({ products });
	}

	if (intent === "create_raffle") {
		const productId = formData.get("productId");
		const productHandle = formData.get("productHandle");
		const productTitle = formData.get("productTitle");
		const quantityAvailable = parseInt(formData.get("quantityAvailable"), 10);
		const deadline = formData.get("deadline");
		const isActive = formData.get("isActive") === "true";

		if (!productId || !productTitle || !quantityAvailable || !deadline) {
			return json({ errors: { form: "Tous les champs obligatoires doivent être remplis." } }, { status: 400 });
		}

		try {
			const response = await admin.graphql(
				`#graphql
		  mutation createRaffleProduct($metaobject: MetaobjectInput!) {
			metaobjectCreate(metaobject: $metaobject) {
			  metaobject {
				id
				field(key: "raffle_product.product_title") { value }
			  }
			  userErrors {
				field
				message
			  }
			}
		  }`,
				{
					variables: {
						metaobject: {
							type: "raffle_product",
							fields: [
								{ key: "product_id", value: productId },
								{ key: "product_handle", value: productHandle },
								{ key: "product_title", value: productTitle },
								{ key: "quantity_available", value: quantityAvailable.toString() },
								{ key: "deadline", value: deadline },
								{ key: "is_active", value: isActive.toString() },
							],
						},
					},
				}
			);
			const responseJson = await response.json();

			if (responseJson.data.metaobjectCreate.userErrors.length > 0) {
				const errors = responseJson.data.metaobjectCreate.userErrors.reduce((acc, err) => {
					const fieldName = err.field && err.field.length > 1 ? err.field[1] : err.field ? err.field[0] : 'general';
					acc[fieldName] = err.message;
					return acc;
				}, {});
				return json({ errors }, { status: 400 });
			}

			return redirect("/app/raffles");
		} catch (error) {
			console.error("Error creating raffle product:", error);
			return json({ errors: { general: "Une erreur inattendue est survenue lors de la création de la tombola." } }, { status: 500 });
		}
	}

	return json({ message: "Invalid request intent." }, { status: 400 });
};


export default function CreateRafflePage() {
	const formFetcher = useFetcher();
	const searchFetcher = useFetcher();
	const submit = useSubmit();
	const loaderData = useLoaderData();
	const actionData = formFetcher.data;

	const [searchTerm, setSearchTerm] = useState("");
	const [selectedProduct, setSelectedProduct] = useState(null);
	const [quantity, setQuantity] = useState("1");
	const [deadline, setDeadline] = useState(new Date().toISOString().split('T')[0]);
	const [time, setTime] = useState("23:59");
	const [isActive, setIsActive] = useState(true);

	const formErrors = actionData?.errors || {};
	const searchResults = searchFetcher.data?.products || [];

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

		const fullDeadline = `${deadline}T${time}:00Z`;

		const formData = new FormData();
		formData.append("productId", selectedProduct.id);
		formData.append("productHandle", selectedProduct.handle);
		formData.append("productTitle", selectedProduct.title);
		formData.append("quantityAvailable", quantity);
		formData.append("deadline", fullDeadline);
		formData.append("isActive", isActive.toString());
		formData.append("intent", "create_raffle");

		formFetcher.submit(formData, { method: "post" });
	}, [selectedProduct, quantity, deadline, time, isActive, formFetcher]);

	useEffect(() => {
		if (formFetcher.state === "idle" && formFetcher.data && !formFetcher.data.errors) {
		}
	}, [formFetcher.state, formFetcher.data]);


	const [{ month, year }, setDate] = useState({
		month: new Date().getMonth(),
		year: new Date().getFullYear(),
	});

	const handleMonthChange = useCallback(
		(month, year) => setDate({ month, year }),
		[]
	);

	return (
		<Page>
			<TitleBar title="Create a new raffle"
				primaryAction={{
					content: "Create a new raffle",
					url: "/app/raffles/new",
				}}
			/>
			<Layout>
				<Layout.Section>
					<Card>
						<BlockStack gap="300">
							<Text as="h2" variant="headingMd">
								1. Select a Shopify product
							</Text>
							<TextField
								label="Search a product"
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
								<Text>Loading products...</Text>
							) : searchResults.length > 0 ? (
								<List type="bullet">
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
															{product.variants.edges[0]?.node?.price ? `Price: ${product.variants.edges[0].node.price.amount} ${product.variants.edges[0].node.price.currencyCode}` : "No price"}
														</Text>
													</BlockStack>
												</InlineStack>
											</Button>
										</List.Item>
									))}
								</List>
							) : searchTerm.length > 2 && searchFetcher.state === "idle" ? (
								<Text>No product found for "{searchTerm}".</Text>
							) : (
								<Text>Type at least 3 characters to search for a product.</Text>
							)}

							{selectedProduct && (
								<BlockStack gap="100">
									<Text as="p" variant="bodyMd" fontWeight="bold">
										Selected product : {selectedProduct.title}
									</Text>
									<Text as="p" variant="bodySm">
										ID: {selectedProduct.id}
									</Text>
								</BlockStack>
							)}
							{formErrors.productId && <Text color="critical">{formErrors.productId}</Text>}
						</BlockStack>
					</Card>

					<Card>
						<BlockStack gap="300">
							<Text as="h2" variant="headingMd">
								2. Configure the raffle details
							</Text>
							<TextField
								label="Quantity of snowboards (number of winners)"
								type="number"
								value={quantity}
								onChange={setQuantity}
								min={1}
								autoComplete="off"
								error={formErrors.quantityAvailable}
							/>

							<Text as="h3" variant="headingSm">Deadline</Text>
							<DatePicker
								month={month}
								year={year}
								onChange={({ end: newDate }) => {
									setDeadline(newDate.toISOString().split('T')[0]);
									setDate({ month: newDate.getMonth(), year: newDate.getFullYear() });
								}}
								onMonthChange={handleMonthChange}
								selected={{
									start: new Date(deadline),
									end: new Date(deadline),
								}}
							/>
							<TextField
								label="Deadline time (HH:MM)"
								type="time"
								value={time}
								onChange={setTime}
								autoComplete="off"
								error={formErrors.deadline}
							/>

							<ChoiceList
								title="Raffle status"
								choices={[
									{ label: "Active", value: "true" },
									{ label: "Inactive", value: "false" },
								]}
								selected={[`${isActive}`]}
								onChange={(value) => setIsActive(value[0] === "true")}
								error={formErrors.isActive}
							/>
						</BlockStack>
					</Card>

					<Button primary onClick={handleSubmit} loading={formFetcher.state === "submitting"}>
						Create the raffle
					</Button>
					{formErrors.general && <Text color="critical">{formErrors.general}</Text>}
				</Layout.Section>
			</Layout>
		</Page>
	);
}