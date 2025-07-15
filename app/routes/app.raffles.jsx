import {
	Page,
	Layout,
	Card,
	Text,
	BlockStack,
	ResourceList,
	ResourceItem,
	Link,
} from "@shopify/polaris";
import { json } from "@remix-run/node";
import { useLoaderData, useNavigate } from "@remix-run/react";
import { authenticate } from "../shopify.server";
import { useState, useEffect } from "react";

export const loader = async ({ request }) => {
	const { admin } = await authenticate.admin(request);

	const response = await admin.graphql(
		`#graphql
	  query getRaffleProducts {
		metaobjects(type: "raffle_product", first: 100) {
		  edges {
			node {
			  id
			  raffleProductIdField: field(key: "product_id") {
				value
			  }
			  raffleProductTitleField: field(key: "product_title") {
				value
			  }
			  raffleQuantityAvailableField: field(key: "quantity_available") {
				value
			  }
			  raffleDeadlineField: field(key: "deadline") {
				value
			  }
			  raffleIsActiveField: field(key: "is_active") {
				value
			  }
			}
		  }
		}
	  }`
	);

	const responseJson = await response.json();
	const metaobjects = responseJson.data.metaobjects.edges.map((edge) => {
		return {
			id: edge.node.id,
			productId: edge.node.raffleProductIdField.value,
			title: edge.node.raffleProductTitleField.value,
			quantityAvailable: parseInt(
				edge.node.raffleQuantityAvailableField.value,
				10
			),
			deadline: edge.node.raffleDeadlineField.value,
			isActive: edge.node.raffleIsActiveField.value === "true",
		};
	});

	return json({ raffles: metaobjects });
};

export default function RafflesPage() {
	const { raffles } = useLoaderData();
	const navigate = useNavigate();
	const [isClient, setIsClient] = useState(false);

	useEffect(() => {
		setIsClient(true);
	}, []);

	return (
		<Page
			title="Manage my raffles"
			primaryAction={{
				content: "Create a new raffle",
				onAction: () => navigate("/app/create"),
			}}
		>
			<Layout>
				<Layout.Section>
					<Card>
						<BlockStack gap="300">
							<Text as="h2" variant="headingMd">
								Products configured in raffle ({raffles.length})
							</Text>
							{raffles.length === 0 ? (
								<Text as="p" variant="bodyMd">
									No raffle configured yet. Click on "Create a new raffle" to
									start.
								</Text>
							) : (
								<ResourceList
									resourceName={{ singular: "raffle", plural: "raffles" }}
									items={raffles}
									renderItem={(item) => {
										const {
											id,
											title,
											productId,
											quantityAvailable,
											deadline,
											isActive,
										} = item;
										const productShopifyId = productId.split("/").pop();

										return (
											<ResourceItem
												id={id}
												onClick={() => {
													// TODO: Naviguer vers la page de détail
													console.log(`Navigating to item ${id}...`);
												}}
												accessibilityLabel={`View details for ${title}`}
											>
												<Text variant="bodyMd" fontWeight="bold" as="h3">
													{title}
												</Text>
												<div>Quantity: {quantityAvailable}</div>
												<div>
													Deadline:{" "}
													{isClient
														? new Date(deadline).toLocaleString()
														: deadline}
												</div>
												<div>Status: {isActive ? "Active" : "Inactive"}</div>
												<Link
													url={`shopify:admin/products/${productShopifyId}`}
													target="_blank"
													removeUnderline
												>
													View the product in Shopify
												</Link>
											</ResourceItem>
										);
									}}
								/>
							)}
						</BlockStack>
					</Card>
				</Layout.Section>
			</Layout>
		</Page>
	);
}