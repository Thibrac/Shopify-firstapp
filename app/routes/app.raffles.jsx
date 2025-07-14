import { Page, Layout, Card, Text, BlockStack, Button, Thumbnail, ResourceList, ResourceItem } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { json } from "@remix-run/node";
import { useLoaderData, Link, useNavigate } from "@remix-run/react";
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
        raffleProductIdField: field(key: "raffle_product.product_id") {
          value
        }
        raffleProductHandleField: field(key: "raffle_product.product_handle") {
          value
        }
        raffleProductTitleField: field(key: "raffle_product.product_title") {
          value
        }
        raffleQuantityAvailableField: field(key: "raffle_product.quantity_available") {
          value
        }
        raffleDeadlineField: field(key: "raffle_product.deadline") {
          value
        }
        raffleIsActiveField: field(key: "raffle_product.is_active") {
          value
        }
      }
    }
  }
}`
	);

	const responseJson = await response.json();
	const metaobjects = responseJson.data.metaobjects.edges.map(edge => {
		const raffle = {};
		raffle.id = edge.node.id;
		raffle.productId = edge.node.raffleProductIdField.value;
		raffle.productHandle = edge.node.raffleProductHandleField.value;
		raffle.title = edge.node.raffleProductTitleField.value;
		raffle.quantityAvailable = parseInt(edge.node.raffleQuantityAvailableField.value, 10);
		raffle.deadline = edge.node.raffleDeadlineField.value;
		raffle.isActive = edge.node.raffleIsActiveField.value === "true";

		return raffle;
	});

	return json({ raffles: metaobjects });
};

export default function RafflesPage() {
	const { raffles } = useLoaderData();
	const [isClient, setIsClient] = useState(false);
	const navigate = useNavigate();

	useEffect(() => {
		setIsClient(true);
	}, []);

	const handleCreateRaffleClick = () => {
		navigate("/app/raffles/new");
	};

	return (
		<Page>

			<TitleBar
				title="Manage my raffles"
			>
			</TitleBar>

			<Layout>
				<Layout.Section>
					<Card>
						<BlockStack gap="300">
							<Text as="h2" variant="headingMd">
								Products configured in raffle ({raffles.length})
							</Text>
							<button
								type="button"
								className="Polaris-Button Polaris-Button--primary Polaris-Button--pressable Polaris-Button--sizeMedium Polaris-Button--textAlignCenter"
								onClick={handleCreateRaffleClick}
							>
								<span className="Polaris-Text--root Polaris-Text--bodySm Polaris-Text--medium">Create a new raffle</span>
							</button>
							{raffles.length === 0 ? (
								<Text as="p" variant="bodyMd">
									No raffle configured yet. Click on "Create a new raffle" to start.
								</Text>
							) : (
								<ResourceList
									resourceName={{ singular: 'raffle', plural: 'raffles' }}
									items={raffles}
									renderItem={(item) => {
										const { id, title, productId, productHandle, quantityAvailable, deadline, isActive } = item;
										const productShopifyId = productId.split('/').pop();

										return (
											<ResourceItem
												id={id}
												url={`/app/raffles/${productShopifyId}`}
												accessibilityLabel={`View details for ${title}`}
												name={title}
											>
												<Text variant="bodyMd" fontWeight="bold" as="h3">
													{title}
												</Text>
												<div>Quantity: {quantityAvailable}</div>
												<div>Deadline: {new Date(deadline).toLocaleString()}</div>
												<div>Status: {isActive ? 'Active' : 'Inactive'}</div>
												<Link url={`shopify:admin/products/${productShopifyId}`} target="_blank" removeUnderline>
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