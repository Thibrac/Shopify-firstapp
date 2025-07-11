import { Page, Layout, Card, Text, BlockStack, Button, Thumbnail, ResourceList, ResourceItem } from "@shopify/polaris";
import { TitleBar } from "@shopify/app-bridge-react";
import { json } from "@remix-run/node";
import { useLoaderData, Link } from "@remix-run/react";
import { authenticate } from "../shopify.server"; // chemin relatif pour shopify.server

// LOADER pour charger les données des tombolas existantes depuis Shopify Metaobjects
export const loader = async ({ request }) => {
	const { admin } = await authenticate.admin(request);

	const response = await admin.graphql(
		`#graphql
query getRaffleProducts {
  metaobjects(type: "raffle_product", first: 100) { # Le type "raffle_product" est correct ici
    edges {
      node {
        id
        # Utilisation d'alias et des clés EXACTES de ton admin Shopify
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

	return (
		<Page>
			<TitleBar title="Gérer mes Tombolas">
				<Link to="/app/raffles/new"> {/* Cette route n'existe pas encore, nous la créerons après */}
					<Button primary>Create a new raffle</Button>
				</Link>
			</TitleBar>

			<Layout>
				<Layout.Section>
					<Card>
						<BlockStack gap="300">
							<Text as="h2" variant="headingMd">
								Products configured in raffle ({raffles.length})
							</Text>
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
										const productShopifyId = productId.split('/').pop(); // Extraire l'ID numérique du GID

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